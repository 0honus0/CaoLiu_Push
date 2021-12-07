# CaoLiu_Push
推送草榴新帖到TG频道

# 1.使用方法  

<1> 补全 Bot_Token , Chat_Id  

<2> npm install  

<3> node app.js 直接运行 或者 使用screen , pm2等守护进程   

[示例群组](https://t.me/CaoLiu_Push)

# 2.已知Bug  
<1>管理员审核中帖子无法发出，并且审核通过无法发出

<2>图片大于5MB无法发送，tg bot api限制

<3>可能发送广告图片，解决方法为后继优化过滤条件

<4>gif无法发送，实现方法与api调用频率冲突，同时也需要过滤规则

node 写同步太难受了，考虑用python重构了
