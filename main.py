import aiohttp
import asyncio
from bs4 import BeautifulSoup
from typing import List
import telegram
import re
import logging
from zhconv import convert
import time
from datetime import datetime
import traceback

logger = logging.getLogger('CaoLiuPush')
logger.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler = logging.StreamHandler()
handler.setFormatter(formatter)
logger.addHandler(handler)

#url , name , fid , img[List] , torrent , size , time , video , author , authorurl , tid
class Info:
    def __init__(self , url):
        self.url = url

BaseUrl = "https://t66y.com/"
Headers = {"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36",\
           "cookie":"PHPSESSID=hhc40g70dadrtu3fqlrdpcq544; 227c9_ck_info=%2F%09; 227c9_winduser=UwcIAAACaAoICF9SAgFQXlZaU1IBBwEFUlJaWwJRVlIAXlMNB1NdPlsFA1FaCl4BBVcAClMAUFRdDgtRUFILCF9aCAYDCQgB; 227c9_groupid=9; 227c9_lastvisit=0%091637758304%09%2Findex.php%3F"}
TIME , FLAG , MAXTEST= 3 , 0 , 3

Token = ""
ChatId = ""

PidForm = { 4:'欧美原创区',
            5:'动漫原创区',
            7:'技术讨论区',
            8:'新时代的我们',
            10:'草榴影视库',    
            15:'亚洲有码原创区',
            21:'HTTP下载区',
            16:'达盖尔的旗帜',
            20:'成人文学交流区',
            22:'在线成人影院',
            25:'国产原创区',
            26:'中字原创区'   }

Bot = telegram.Bot(token=Token)
PushList = [ 4 , 5 , 7 , 8 , 15 , 16 , 20 , 21 , 22 , 25 , 26 ]
#记录最新帖子
LATEST = "0"

#获取每个版块的最新帖子列表
async def GetContentByFid(fid : int) -> List['Info']:
    FetchUrl = f"https://t66y.com/thread0806.php?fid={fid}&search=today"
    async with aiohttp.ClientSession(trust_env = True) as session:
        async with session.get(FetchUrl, headers=Headers) as response:
            html = await response.text()
            if "Forbidden" in html:
                logger.error("Access Forbidden")
                return []
            soup = BeautifulSoup(html, 'lxml')
            items = soup.find('tbody' , id = 'tbody').find_all('tr' , class_ = "tr3 t_one tac")
            postlist = []
            for item in items:
                Url = BaseUrl + item.find('h3').find('a' ,target='_blank' ).get('href').replace('data','mob')
                Tid = Url.split('/')[-1].replace(".html","").replace("read.php?tid=", "")
                Name = item.find('h3').find('a' ,target='_blank' ).get_text()
                Author = item.find('a',class_='bl').get_text()
                AuthorUrl = BaseUrl + item.find('a',class_='bl').get('href')
                Time = GetTime(item.find('div',class_='f12').find('span').get('title') + " " + item.find('div',class_='f12').find('span').get_text())

                info = Info(Url)
                info.name = Name
                info.fid = fid
                info.tid = Tid
                info.author = Author
                info.authorurl = AuthorUrl
                if Time == None:
                    info.time = None
                else:
                    info.time = Time
                postlist.append(info)
        return postlist

#解析一个帖子的内容 info.images , info.torrent , info.size , info.video
async def ParseContent(info : 'Info') -> 'Info':
    async with aiohttp.ClientSession(trust_env = True) as session:
        async with session.get(info.url, headers=Headers) as response:
            html = await response.text()
            if "Forbidden" in html:
                info.images = None
                info.torrent = None
                info.size = None
                info.video = None
                return info
            soup = BeautifulSoup( html , 'lxml')

            #图片链接
            try:
                info.images = []
                Imgs = soup.find_all('img')
                for img in Imgs:
                    if ("src" in str(img)) and ("gif" not in str(img)):
                        info.images.append(img.get('src'))
                    elif ("ess-data" in str(img))  and ("gif" not in str(img)):
                        info.images.append(img.get('ess-data'))
                    elif "gif" in str(img):
                        pass
                    else:
                        logger.error(f"{img} 图片未处理")
                if info.images == []:
                    info.images = None
            except:
                info.images = None

            #获取hash并获取torrent链接
            try:   
                Hash = soup.find('a' , {"href": re.compile(r"^http:\/\/www.rmdown.com\/link.php\?hash=")}).get_text().split('=')[-1]
                info.torrent = f"magnet:?xt=urn:btih:{Hash}"
            except:
                info.torrent = None

            #如果有文件大小信息,通过正则提取
            try:
                pat = "((\-|\+)?\d+\.\d+[GMgm]?[Bb]?)"
                Size = re.search(pat , soup.get_text("|")).group(0)
                info.size = Size.strip()
            except:
                info.size = None

            #获取视频链接
            try:
                Video = "=".join(soup.find('a' , {"onclick": re.compile("^getElementById\('iframe1'\).src='")}).get("onclick").split("=")[1:]).replace("'","")
                info.video = Video
            except:
                info.video = None
    return info

# 主要用于未经过管理员审核的帖子
# def GetMissId(IdList : List) -> List:
#     left = 0 
#     right = 1
#     MissId = []
#     while left < len(IdList)-1:
#         if int(IdList[left].tid) + 1 == int(IdList[right].tid):
#             left += 1
#             right += 1
#         else:
#             temp = int(IdList[left].tid)
#             while (temp + 1) != int(IdList[right].tid):
#                 MissId.append(temp + 1)
#                 temp+=1
#             left += 1
#             right += 1
#     return MissId

def GetTime(Str : str):
    year = "(\d+-\d+-\d+)"
    try:
        time1 = re.search(year , Str)
    except:
        time1 = None
    
    day = "(\d+\:\d+)"
    try:
        time2 = re.search(day , Str)
    except:
        time2 = None
    return time1.group(0) + " " + time2.group(0)

def Convert(Str : str):
    return Str.replace("【","[").replace("】","]").replace("《","<").replace("》",">")

def Publish(info : 'Info' , SendWithImage : bool = True):
    global TIME
    global FLAG
    global MAXTEST

    Section = f"版       块 :   *#{PidForm[info.fid]}*\n"
    Theme =   f"主       题 :   *{Convert(convert(info.name , 'zh-cn'))}*\n"
    Link =    f"直达链接 : [{info.url}]({info.url})\n"
    Author =  f"发  布  者 : [{info.author}]({info.authorurl})\n"
    Time =    f"时       间 :  *{info.time}*\n"
    Video =   f"视频链接 : [{info.video}]([{info.video})\n"
    Size =    f"文件大小 : *{info.size}*\n"
    Torrent = f"磁力链接 :  `{info.torrent}`\n"

    PublishContent = Section + Theme + Link + Author + Time
    if info.size != None:
        PublishContent += Size
    if info.video != None:
        PublishContent += Video
    if info.torrent != None:
        PublishContent += Torrent

    try:
        if not SendWithImage:
            Bot.sendMessage(chat_id = ChatId, text = PublishContent , parse_mode = "Markdown" , disable_web_page_preview = True)
        else:
            if info.images == None:
                Bot.sendMessage(chat_id = ChatId, text = PublishContent , parse_mode = "Markdown" , disable_web_page_preview = True)
            elif len(info.images) == 1:
                Bot.sendPhoto(chat_id = ChatId, photo = info.images[0], caption = PublishContent, parse_mode = "Markdown")
            else:
                ContentList = []
                ImagesCount = len(info.images[0:3])
                for index in range(ImagesCount):
                    if index == 0:
                        ContentList.append(telegram.InputMediaPhoto(media = info.images[index], caption = PublishContent, parse_mode = "Markdown"))
                    else:
                        ContentList.append(telegram.InputMediaPhoto(media = info.images[index], caption = None, parse_mode = "Markdown"))
                Bot.sendMediaGroup(chat_id = ChatId, media = ContentList)
                TIME += 3 * ImagesCount
        time.sleep(TIME)
        FLAG = 0
        TIME = 3
    except telegram.error.BadRequest:
        TIME = 3 * (FLAG + 1)
        if FLAG < MAXTEST:
            FLAG += 1
            time.sleep(TIME)
            Publish(info , False)
        else:
            FLAG = 0
            TIME = 3
            return False
    except:
        traceback.print_exc()
        TIME = 3 * (FLAG + 1)
        if FLAG < MAXTEST:
            FLAG += 1
            time.sleep(TIME)
            Publish(info)
        else:
            FLAG = 0
            TIME = 3
            return False

async def Main():
    global LATEST
    task = []
    for fid in PushList:
        task.append(GetContentByFid(fid))
    Result = await asyncio.gather(*task)
    AllContent = []
    for items in Result:
        AllContent.extend(items)
    AllContent.sort(key = (lambda x : x.tid))

    flag = 0
    for index in range(len(AllContent)):
        if int(AllContent[index].tid) > int(LATEST):
            LATEST = int(AllContent[-1].tid)
            AllContent = AllContent[index:]
            flag = 1
            break
    if flag == 0:
        AllContent = []

    task = []
    for info in AllContent:
        task.append(ParseContent(info))
    infos = await asyncio.gather(*task)

    for info in infos:
        Publish(info)


async def Start():
    while True:
        starttime = datetime.now()
        await Main()
        endtime = datetime.now()
        runtime = (endtime - starttime).seconds
        logger.debug(f"耗时 {runtime} 秒")
        if runtime < 5 * 60:
            await asyncio.sleep(5 * 60 - runtime)

loop = asyncio.get_event_loop()
loop.run_until_complete(Start())