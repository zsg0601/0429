var express = require('express');
var pako = require('pako');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io').listen(server);
var bodyParser = require('body-parser');
var postToken = "94402e5ec6a02d0be460716f4b5acaf57482485c0ce86aab492d1d4876af3464"
var cacheStr = [];
//item缓存
var cacheItems = [];
var newcacheItem = [];
//Vehicle缓存
var cacheVehicle = [];
var newcacheVehicle = [];
//cache
var lastPacket = {"m":1,"s":cacheStr,"i":cacheItems,"v":cacheVehicle};
var port = 7890;
// 地图数据
var DUMPDATA = {};
// socket clients
var CLIENTS = [];
// 静态文件
app.use(express.static('static'));
//body-parser 解析json格式数据
app.use(bodyParser.json({
    limit: '1mb'
}));
//此项必须在 bodyParser.json 下面,为参数编码
app.use(bodyParser.urlencoded({
    extended: true
}));

//Get Post Data
app.post('/', function (req, res) {
    DUMPDATA = req.body;
    //console.log(DUMPDATA);
    if(postToken==DUMPDATA.t)
    {
        DUMPDATA.t =null;
    }
    else
    {
        res.end('fail');
        return;
    }
    res.end('confirm');
    lastPacket = DUMPDATA;
    if(DUMPDATA.s&&cacheStr.length!=DUMPDATA.s.length)
    {
        cacheStr = DUMPDATA.s;
    }
    else
    {
        DUMPDATA.s = null;
    }
    //物品缓存
    if(DUMPDATA.i!=null)
    {
        newcacheItem = DUMPDATA.i.concat();
    }
    //标记待删除
    for(var c in cacheItems)
    {
        cacheItems[c].f = false;
    }
    //判断保持的物品
    for (var i in DUMPDATA.i){
        for(var c in cacheItems)
        {
            if(cacheItems[c]!=null&&DUMPDATA.i[i]!=null)
            {
                if(DUMPDATA.i[i].x==cacheItems[c].x&&DUMPDATA.i[i].y==cacheItems[c].y&&DUMPDATA.i[i].n==cacheItems[c].n)
                {
                    //存在的删除
                    DUMPDATA.i.splice(i,1);
                    cacheItems[c].f = true;
                }
            }
        }
    }
    for(var c in cacheItems)
    {
        if(cacheItems[c].f==false)
        {
            DUMPDATA.i.push(cacheItems[c]);
        }
    }
    cacheItems = null;
    cacheItems = newcacheItem;

    //判断Vehicle缓存
    if(DUMPDATA.v!=null)
    {
        newcacheVehicle = DUMPDATA.v.concat();
    }
    else
    {
         DUMPDATA.v = [];
    }
    for(var c in cacheVehicle)
    {
        cacheVehicle[c].f = false;
    }

    for (var i in DUMPDATA.v){
        for(var c in cacheVehicle)
        {
            if(cacheVehicle[c]!=null&&DUMPDATA.v[i]!=null)
            {
                if(DUMPDATA.v[i].x==cacheVehicle[c].x&&DUMPDATA.v[i].y==cacheVehicle[c].y&&DUMPDATA.v[i].n==cacheVehicle[c].n&&DUMPDATA.v[i].r==cacheVehicle[c].r&&DUMPDATA.v[i].d==cacheVehicle[c].d)
                {
                    //存在的删除
                    DUMPDATA.v.splice(i,1);
                    cacheVehicle[c].f = true;
                }
            }
        }
    }
    for(var c in cacheVehicle)
    {
        if(cacheVehicle[c].f==false)
        {
            DUMPDATA.v.push(cacheVehicle[c]);
        }
    }
    cacheVehicle = null;
    cacheVehicle = newcacheVehicle;
    for (var index = 0; index < CLIENTS.length; index++) {
        DUMPDATA.t = new Date().getTime();
        DUMPDATA.t = DUMPDATA.t - CLIENTS[index].timeoffset;
        CLIENTS[index].emit('u',DUMPDATA);
    }
});

io.on('connection', function (socket) {
    socket.timeoffset = 0;
    socket.on('t',function(timeset){
        var thisnowtime = new Date().getTime();
        socket.timeoffset = thisnowtime -  timeset;
    })
    CLIENTS.push(socket);
    console.log(`a user connected IP:[${socket.conn.remoteAddress}], current users: [${CLIENTS.length}]`);
    var json_str = JSON.stringify(lastPacket);
    var output = pako.deflate(json_str);
    socket.emit('u',output);
    socket.on('disconnect', function () {
        for (var index = 0; index < CLIENTS.length; index++) {
            if (CLIENTS[index] === socket) {
                CLIENTS.splice(index, 1);
            }
        }
        console.log(`a user disconnect, current users: [${CLIENTS.length}]`);
    });
});

server.listen(port, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log(`server running at localhost:${port}`);
});
