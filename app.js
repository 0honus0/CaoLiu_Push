/*
 * @Author: honus
 * @Date: 2021-11-13 23:43:19
 * @LastEditTime: 2021-11-24 21:35:43
 * @LastEditors: honus
 * @Description: 
 * @FilePath: /CaoLiuPush/app.js
 */
var Crawler=require("crawler");
const https = require('https')
const fs = require('fs')
var log4js=require("log4js");
var querystring = require("querystring");
var logger = log4js.getLogger();
var chineseConv = require('chinese-conv');

logger.level = "info";

const base_url='https://t66y.com/'
const Bot_Token=""
const Chat_Id=''
const User_Agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36'
const Cookie='P'
var publish={'tid':0};
var flag=1
var key=0
var date =Date.now()

try{
    var data = fs.readFileSync('./publish.js');
    publish=JSON.parse(data)
    
    logger.info('Reading config success')
} catch(err) {
    logger.error(err)
}

//[{'article_url':(base_url+article_url),'time':time,'forum':res.options.forum,'title':title,'author':author,'author_url':+base_url+author_url,'fid':res.options.fid}]
let tmp_list=[];

main()
let begin=setInterval(() => { 
    if(key==1){
    logger.info('begin loop')
    setInterval( main ,5*60000)
    clearInterval(begin)
    }
},5000)

function main(){
    if(flag==0){
        logger.info('running')
        return;
    }
    logger.info('begin running')
    flag=0
    const c = new Crawler({
        rateLimit: 2000,
        callback: (error, res, done) => {
            if (error) {
                logger.error(error);
            } else {
                const $ = res.$;
                if($('title').text()=='403 Forbidden'){
                    logger.error('403 Forbidden')
                    return
                }
                $('tbody tr[class="tr3 t_one tac"]').each(function(){
                    let status=$(this).find('td').first().text().replace(/\r?\n?/g, '').replace(/\s/g,"")
                    let title=$(this).find('h3 a[target="_blank"]').text().replace(/\r?\n?/g, '').replace(/\s/g,"")
                    let author=$(this).find('a[class="bl"]').text().replace(/\r?\n?/g, '').replace(/\s/g,"")

                    // if (author == 'valen'){
                    //     return;
                    // }
                     
                    let article_url=$(this).find('h3 a[target="_blank"]').attr('href');
                    let author_url=$(this).find('td a[class="bl"]').attr('href');

                    if(status=='LOCK'){
                        return;
                    };

                    let Today=$(this).find('div[class="f12"] span').hasClass('s3');
                    let time=null;
                    if(Today){
                        time=$(this).find('div[class="f12"] span[class="s3"]').text();
                        if(time=='Top-marks'){
                            time=$(this).find('div[class="f12"] span[class="s3"]').attr('title').replace('置顶主题：','').slice(0,-3);
                        } else {
                            time=Time(0,time,date);
                        }
                    };
                    let Yesterday=$(this).find('div[class="f12"] span').hasClass('s5');
                    if(Yesterday){
                        time=$(this).find('div[class="f12"] span[class="s5"]').text();
                        time=Time(1,time,date);
                    };

                    if(time==null){
                        let date=$(this).find('div[class="f12"] span').text();
                        time=$(this).find('div[class="f12"] span').attr('title');
                        time=date+' '+time;
                    };
                    tmp_list.push({'article_url':(base_url+article_url),'time':time,'forum':res.options.forum,'title':title,'author':author,'author_url':(base_url+author_url),'fid':res.options.fid,'tid':getTid(article_url)});            
                });
            };
            done();
        }
    })

    c.on('drain',function(){
        logger.info('Get data success')
        tmp_list.sort(function(a,b){
                return a['tid'] <= b['tid'] ? 1:-1
        })
        //logger.info(tmp_list)
        let maxNumber=getMax(tmp_list)
        logger.info('current max tid:' + maxNumber)
        tmp_list=Array.from(new Set(tmp_list))
        let tmp_list_filter=[]
        tmp_list.reverse()
        for(let i in tmp_list){
            tmp_tid=getTid(tmp_list[i]['article_url'])
            if(tmp_tid > publish['tid'] && tmp_tid <= maxNumber){
                publish['tid']=tmp_tid
                tmp_list_filter.push(tmp_list[i])
            }
        }
        logger.info(tmp_list.length)
        logger.info(tmp_list_filter.length)
        logger.info('del: '+(tmp_list.length-tmp_list_filter.length))
        tmp_list=JSON.parse(JSON.stringify(tmp_list_filter.reverse()))
        var length=tmp_list.length
        let loop=setInterval(function (){
            if(tmp_list.length==0){
                try {
                    logger.info('current tid:'+publish['tid'])
                    fs.writeFileSync('./publish.js', JSON.stringify(publish))
                    flag=1
                    key=1
                } catch (err) {
                    logger.error(err)
                }
                return clearInterval(loop)
            }
            tmp=tmp_list.pop();
            Publish(tmp)
            logger.info((length-tmp_list.length)+'/'+length,tmp['article_url'])
        },4000);
    });
    //两遍是为了防止遗漏，奇怪的bug，等等想办法用别的方法解决吧
    c.queue([
    {
        headers:{'User-Agent': User_Agent,'cookie': Cookie},
        url:'https://t66y.com/thread0806.php?fid=2&search=today',
        forum:'亚洲无码原创区',
        fid:2
    },
    {
        headers:{'User-Agent': User_Agent,'cookie': Cookie},
        url:'https://t66y.com/thread0806.php?fid=15&search=today',
        forum:'亚洲有码原创区',
        fid:15
    },
    {
        headers:{'User-Agent': User_Agent,'cookie': Cookie},
        url:'https://t66y.com/thread0806.php?fid=4&search=today',
        forum:'欧美原创区',
        fid:4
    },
    {
        headers:{'User-Agent': User_Agent,'cookie': Cookie},
        url:'https://t66y.com/thread0806.php?fid=5&search=today',
        forum:'动漫原创区',
        fid:5
    },
    {
        headers:{'User-Agent': User_Agent,'cookie': Cookie},
        url:'https://t66y.com/thread0806.php?fid=25&search=today',
        forum:'国产原创区',
        fid:25
    },
    {
        headers:{'User-Agent': User_Agent,'cookie': Cookie},
        url:'https://t66y.com/thread0806.php?fid=26&search=today',
        forum:'中字原创区',
        fid:26
    },
    {
        headers:{'User-Agent': User_Agent,'cookie': Cookie},
        url:'https://t66y.com/thread0806.php?fid=21&search=today',
        forum:'HTTP下载区',
        fid:21
    },
    {
        headers:{'User-Agent': User_Agent,'cookie': Cookie},
        url:'https://t66y.com/thread0806.php?fid=22&search=today',
        forum:'在线成人影院',
        fid:22
    },
    {
        headers:{'User-Agent': User_Agent,'cookie': Cookie},
        url:'https://t66y.com/thread0806.php?fid=10&search=today',
        forum:'草榴影视库',
        fid:10
    },
    {
        headers:{'User-Agent': User_Agent,'cookie': Cookie},
        url:'https://t66y.com/thread0806.php?fid=7&search=today',
        forum:'技术讨论区',
        fid:7
    },
    {
        headers:{'User-Agent': User_Agent,'cookie': Cookie},
        url:'https://t66y.com/thread0806.php?fid=8&search=today',
        forum:'新时代的我们',
        fid:8
    },
    {
        headers:{'User-Agent': User_Agent,'cookie': Cookie},
        url:'https://t66y.com/thread0806.php?fid=16&search=today',
        forum:'达盖尔的旗帜',
        fid:16
    },
    {
        headers:{'User-Agent': User_Agent,'cookie': Cookie},
        url:'https://t66y.com/thread0806.php?fid=20&search=today',
        forum:'成人文学交流区',
        fid:20
    },
    {
        headers:{'User-Agent': User_Agent,'cookie': Cookie},
        url:'https://t66y.com/thread0806.php?fid=2&search=today',
        forum:'亚洲无码原创区',
        fid:2
    },
    {
        headers:{'User-Agent': User_Agent,'cookie': Cookie},
        url:'https://t66y.com/thread0806.php?fid=15&search=today',
        forum:'亚洲有码原创区',
        fid:15
    },
    {
        headers:{'User-Agent': User_Agent,'cookie': Cookie},
        url:'https://t66y.com/thread0806.php?fid=4&search=today',
        forum:'欧美原创区',
        fid:4
    },
    {
        headers:{'User-Agent': User_Agent,'cookie': Cookie},
        url:'https://t66y.com/thread0806.php?fid=5&search=today',
        forum:'动漫原创区',
        fid:5
    },
    {
        headers:{'User-Agent': User_Agent,'cookie': Cookie},
        url:'https://t66y.com/thread0806.php?fid=25&search=today',
        forum:'国产原创区',
        fid:25
    },
    {
        headers:{'User-Agent': User_Agent,'cookie': Cookie},
        url:'https://t66y.com/thread0806.php?fid=26&search=today',
        forum:'中字原创区',
        fid:26
    },
    {
        headers:{'User-Agent': User_Agent,'cookie': Cookie},
        url:'https://t66y.com/thread0806.php?fid=21&search=today',
        forum:'HTTP下载区',
        fid:21
    },
    {
        headers:{'User-Agent': User_Agent,'cookie': Cookie},
        url:'https://t66y.com/thread0806.php?fid=22&search=today',
        forum:'在线成人影院',
        fid:22
    },
    {
        headers:{'User-Agent': User_Agent,'cookie': Cookie},
        url:'https://t66y.com/thread0806.php?fid=10&search=today',
        forum:'草榴影视库',
        fid:10
    },
    {
        headers:{'User-Agent': User_Agent,'cookie': Cookie},
        url:'https://t66y.com/thread0806.php?fid=7&search=today',
        forum:'技术讨论区',
        fid:7
    },
    {
        headers:{'User-Agent': User_Agent,'cookie': Cookie},
        url:'https://t66y.com/thread0806.php?fid=8&search=today',
        forum:'新时代的我们',
        fid:8
    },
    {
        headers:{'User-Agent': User_Agent,'cookie': Cookie},
        url:'https://t66y.com/thread0806.php?fid=16&search=today',
        forum:'达盖尔的旗帜',
        fid:16
    },
    {
        headers:{'User-Agent': User_Agent,'cookie': Cookie},
        url:'https://t66y.com/thread0806.php?fid=20&search=today',
        forum:'成人文学交流区',
        fid:20
    }
    ]);
}

function getMax(e){
    let value=-1
    let i_list=[]
    for(let i in e){
        i_list.push(e[i]['tid'])
    }
    i_list.reverse()
    while(-value <= i_list.length){
        key=i_list.slice(value)[0]
        if(i_list.indexOf(key) != i_list.lastIndexOf(key)){
            return key
        }
        value-=1
    }
}

function getTid(url){
    let tid=null
    try{
        let pat= /(\d+).html/;
        let re=new RegExp(pat);
        tid=re.exec(url)[1]
    } catch(err){
        if(tid==null){
            let pat= /tid=(\d+)/;
            let re=new RegExp(pat);
            tid=re.exec(url)[1]
        }
    }
    return tid
}

function Time(flag,time,now){
    let pat= /(\d+:\d+)/;
    let re=new RegExp(pat);
    time=re.exec(time)[0]
    if(flag){
        return (new Date(now - 86400000)).format("yyyy-MM-dd")+' '+time;
    } else {
        return (new Date(now)).format("yyyy-MM-dd")+' '+time;
    }
};

function Publish(tmp){
    text="版     块:  <b>#"+tmp['forum']+"</b>\n主     题:  <b>"+chineseConv.sify(tmp['title'].replaceAll('【','[').replaceAll('】',']').replaceAll('<','《').replaceAll('>','》'))
    +"</b>\n发布者: <a href=\""+tmp['author_url']+"\">"+tmp['author']+"</a>\n时    间: "
    +tmp['time']+"\n直达链接: " + tmp['article_url'].replace('htm_data','htm_mob')+'\n'
    const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path:  '/bot'+Bot_Token+'/sendMessage?parse_mode=HTML&chat_id='+Chat_Id+"&text=" + querystring.escape(text) +'&disable_web_page_preview=1',
        method: 'GET'
      }
    const req = https.request(options, res => {
        res.on('data', d => {
            let res=JSON.parse(d)
            if(res['ok']==false){
                logger.error('send failed')
                logger.error(process.stdout.write(d+'\n'))
                logger.error(tmp)
                logger.error(text)
                logger.error(encodeURI(text))
            }
        })
      })
      
    req.on('error', error => {
        logger.error(error)
    }) 
      req.end()
}

Date.prototype.format = function (fmt) {
    var o = {
        "M+": this.getMonth() + 1,                   //月份
        "d+": this.getDate(),                        //日
        "h+": this.getHours(),                       //小时
        "m+": this.getMinutes(),                     //分
        "s+": this.getSeconds(),                     //秒
        "q+": Math.floor((this.getMonth() + 3) / 3), //季度
        "S": this.getMilliseconds()                  //毫秒
    };

    //  获取年份 
    // ①
    if (/(y+)/i.test(fmt)) {
        fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    }

    for (var k in o) {
        // ②
        if (new RegExp("(" + k + ")", "i").test(fmt)) {
        fmt = fmt.replace(
            RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
        }
    }
    return fmt;
};
