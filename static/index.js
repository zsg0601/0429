$(function () {
    function onResize() {
        var height = window.innerHeight;
        var is_safari = navigator.userAgent.indexOf("Safari") > -1;

        if ((navigator.userAgent.match(/iPhone/i)) ||
            (navigator.userAgent.match(/iPod/i))) {
            if (is_safari) {
                height += 80;
            }
        }
        $('#radar').attr("width", window.innerWidth).attr("height", height);
        console.log( window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize);
    onResize();

    // 禁止移动端弹性webview
    document.ontouchmove = function (event) {
        event.preventDefault();
    }
})
$(function () {
    var radar = new Radar($('#radar')[0]);
    var mapSizState = "Run";
    var mapSizState2 = "NoShowItem";
    var socket = io();
    //同步时间
    var thisnowtime = new Date().getTime();
    socket.emit('t',thisnowtime);
    var SocketDelay = 0;

    var socketUpdateCounter = new Utils.MinsCounter();
    var cacheStr = [];
    var masterSelfX = 0;
    var masterSelfY = 0;
    var SelfMoveSpeed = 0;
    var SelfX_O = 0;
    var SelfY_O = 0;

    var updatetime_sec = (new Date()).valueOf();
    var items_iconimg = new Image;
    items_iconimg.src="./item-sprites.png";
    var items_iconinfo ={};
    jQuery.getJSON("./item-sprites.json",function(result){
            result.forEach(function(value, index, array) {
                if(value!=null)
                {
                    items_iconinfo[value["name"]] = {
                        "packedHeight":value.packedHeight,
                        "packedWidth":value.packedWidth,
                        "offsetX":value.texture.data.width*value.u,
                        "offsetY":value.texture.data.height*value.v-value.originalHeight,
                    }
                }
                
            })
        }
    );
    var translate ={
        "TwoSeatBoat":"快艇",
        "FourSeatDU":"吉普",
        "FourSeatP":"轿车",
        "SixSeatBoat":"船",
        "Dacia":"跑车",
        "Uaz":"UAZ铁皮",
        "Pickup":"皮卡车",
        "Buggy":"三蹦子",
        "Bike":"摩的",
        "SideCar":"三轮车",
        "Bus":"巴士"
    };
    socket.on('u', function (snapshot) {
        //zlib解压
        try {
            var olditems = locations.i;
            var oldvehicle = locations.v;
            if(olditems==null)
            {
                olditems = [];
            }
            if(oldvehicle==null)
            {
                oldvehicle = [];
            }
            locations = snapshot;
            var thisnowtime = new Date().getTime();
            SocketDelay = thisnowtime-locations.t
            if(locations.s != null)
            {
                cacheStr = locations.s;
            }
            //-----------------------------------
            //处理缓存物品
            for (var i in locations.i){
                //删除物品
                if(locations.i[i].f==false)
                {
                    for(var c in olditems)
                    {
                        if(locations.i[i].x==olditems[c].x&&locations.i[i].y==olditems[c].y&&locations.i[i].n==olditems[c].n)
                        {
                            olditems.splice(c,1);
                        }
                    }
                }
                else
                {
                    olditems.push(locations.i[i]);
                }
            }
            locations.i = olditems;
            //-----------------------------------
            for (var i in locations.v){
                //删除物品
                if(locations.v[i].f==false)
                {
                    for(var c in oldvehicle)
                    {
                        if(locations.v[i].x==oldvehicle[c].x&&locations.v[i].y==oldvehicle[c].y&&locations.v[i].n==oldvehicle[c].n&&locations.v[i].r==oldvehicle[c].r&&locations.v[i].d==oldvehicle[c].d)
                        {
                            oldvehicle.splice(c,1);
                        }
                    }
                }
                else
                {
                    oldvehicle.push(locations.v[i]);
                }
            }
            locations.v = oldvehicle;

            var thisnowtime = new Date().getTime();
            socket.emit('t',thisnowtime);
            socketUpdateCounter.update();
            redraw();
        } catch (err) {
          console.log(err);
          
        }finally{
            
        }
    });

    var locations = {};
    var trackPlayerIndex = parseInt(Utils.getParameterByName('id') || 0);
    var maps = ['Erangel.png', 'Miramar.png'];
    var mapParameter = Utils.getParameterByName('map');
    if (mapParameter === '1') {
        radar.setMap(maps[0]);
    } else if (mapParameter === '2') {
        radar.setMap(maps[1]);
    } else {
        var mapParameter = '1';
        radar.setMap(maps[0]);
    }


    // 手势支持
    var hammertime = new Hammer.Manager($('.container')[0]);
    hammertime.add(new Hammer.Pan({
        threshold: 0
    }));
    hammertime.add(new Hammer.Pinch({
        threshold: 0
    }));

    // 拖动
    var lastDelta = {
        x: 0,
        y: 0
    }
    hammertime.on('panmove', function (ev) {
        radar.setMove(ev.deltaX - lastDelta.x, ev.deltaY - lastDelta.y);
        lastDelta.x = ev.deltaX;
        lastDelta.y = ev.deltaY;
        redraw();
    });
    hammertime.on('panend', function (ev) {
        lastDelta = {
            x: 0,
            y: 0
        }
    });

    // 缩放
    var lastScale = 0;
    hammertime.on('pinchmove', function (ev) {
        var size = 0.5;
        if (lastScale > ev.scale) {
            size = -size;
        }

        radar.setZoom(Math.pow(1.1, size));
        lastScale = ev.scale;
        redraw();
    });
    hammertime.on('pinchend', function () {
        lastScale = 0;
    });

    // 鼠标滚轮缩放
    $('.container').on("mousewheel DOMMouseScroll", function (e) {
        
        var evt = e.originalEvent;
        var delta = evt.wheelDelta ? evt.wheelDelta / 40 : evt.detail ? -evt.detail : 0;
        if(radar.scaledFactor<=10||delta<=0)
        {
            
            if (delta) {
                radar.setZoom(Math.pow(1.1, delta));
                redraw();
            }
            return evt.preventDefault() && false;
        }
        
    });
    function redraw() {
        ifChangeMap();
        radar.clear();
        var trackPlayerName = Utils.getParameterByName('name') || null;
        if(locations.p&&trackPlayerName!=null)
        {
            for (var i = locations.p.length - 1; i >= 0; i--) {
                if(trackPlayerName == unPackStr(locations.p[i].n))
                {
                    trackPlayerIndex = i;
                    break;
                }

            }
        }
        else if(parseInt(Utils.getParameterByName('id') || 0)!=0)
        {
            trackPlayerIndex = parseInt(Utils.getParameterByName('id') || 0);
        }
        if(locations.p&&locations.p.length>=1)
        {
            masterSelfX =  locations.p[0].x;
            masterSelfY =  locations.p[0].y;
        }
        if (locations.p && locations.p[trackPlayerIndex]&&unPackStr(locations.p[trackPlayerIndex].d)=="t") {
            var player = locations.p[trackPlayerIndex];
            radar.setFocus(player.x, player.y);
        }
        else if(locations.p&&trackPlayerIndex!=0)
        {
            trackPlayerIndex--;
            var player = locations.p[trackPlayerIndex];
            radar.setFocus(player.x, player.y);
        }
        else
        {
            radar.clear();
            return;
        }
        
        radar.map();
        //画自己的范围
        if(locations.p[0])
        {
            radar.Arc(locations.p[0].x, locations.p[0].y,1000*102.4,1,"rgba(255,255,255,0.1)","rgba(255,255,255,0.1)");
        }
        drawVehicles();
        if(parseInt(Utils.getParameterByName('item') || 1)!=0&&radar.scaledFactor>=2)
        {
            drawItems();
        }
        drawMisc();
        drawPlayers();
        var nowtime = (new Date()).valueOf();
        if(nowtime-updatetime_sec>=1000)
        {
            SelfMoveSpeed = md2rd(getP2PLong(locations.p[trackPlayerIndex].x,locations.p[trackPlayerIndex].y,SelfX_O,SelfY_O));
            SelfMoveSpeed = SelfMoveSpeed *3.6;
            SelfX_O = locations.p[trackPlayerIndex].x;
            SelfY_O = locations.p[trackPlayerIndex].y;
            updatetime_sec = nowtime;
            autoMoveMap();
        }
        
    }
    //用于判断是否更换地图
    function ifChangeMap(){
        if (!locations.m) {
            return;
        }
        var mapid = locations.m;
        if(mapid !== mapParameter){
            mapParameter = mapid;
            if (mapParameter === 1) {
                radar.setMap(maps[0]);
            } else if (mapParameter === 2) {
                radar.setMap(maps[1]);
            } else {
                radar.setMap(maps[Math.random() < .5 ? 1 : 0]);
            }
        }
    }
    function autoMoveMap(){
        if(0<SelfMoveSpeed&&SelfMoveSpeed<=35)
        {
            //console.log("Run");
            if(mapSizState=="Driver")
            {
                radar.setZoom(Math.pow(1.1, +10));
            }
            else if(mapSizState=="Fly")
            {
                radar.setZoom(Math.pow(1.1, +15));
            }
            mapSizState = "Run";
            redraw();
        }
        else if(35<SelfMoveSpeed&&SelfMoveSpeed<=150)
        {
            //console.log("Driver");
            if(mapSizState=="Run")
            {
                radar.setZoom(Math.pow(1.1, -10));
            }
            else if(mapSizState=="Fly")
            {
                radar.setZoom(Math.pow(1.1, +5));
            }
            mapSizState = "Driver";
            redraw();
        }
        else if(150<SelfMoveSpeed&&SelfMoveSpeed<=5000)
        {
            //console.log("Fly");
            if(mapSizState=="Run")
            {
                radar.setZoom(Math.pow(1.1, -15));
            }
            else if(mapSizState=="Driver")
            {
                radar.setZoom(Math.pow(1.1, -5));
            }
            mapSizState = "Fly";
            redraw();
        }
    }
    function drawPlayers() {

        if (!locations.p) {
            return;
        }
        var players = locations.p;
        for (var i = players.length - 1; i >= 0; i--) {
            var player = players[i];
            var color = "";
            if (i == trackPlayerIndex) {
                color = '#00BB00';
            } else if (players[trackPlayerIndex].t == player.t) {
                color = '#0033BB';
            } else {
                color = '#ff0000';
            }
            if (player.h == 0) {
                color = '#000000';
                radar.dot(player.x, player.y, color);
            } else {
                if(player.r != 0){
                    radar.lineWithAngle(player.x, player.y, 15, 6, player.r, color);
                }
                radar.dot(player.x, player.y, color);
                radar.pieChart(player.x, player.y, ((100 - player.h) / 100), 'gray')
            }
            //辅助线
            radar.dline(players[trackPlayerIndex].x,players[trackPlayerIndex].y,player.x,player.y,"rgba(255,255,255,0.3)",0.4);
            var plong = getP2PLong(players[trackPlayerIndex].x,players[trackPlayerIndex].y,player.x,player.y);
            if(md2rd(plong)<=150&&unPackStr(player.d) != "t")
            {
                radar.dline(players[trackPlayerIndex].x,players[trackPlayerIndex].y,player.x,player.y,"rgba(255,0,0,0.5)",1.5);
            }

            if(isInView(players[trackPlayerIndex].x,players[trackPlayerIndex].y,player.x,player.y,player.r))
            {
                //近距离敌人
                //百米内
                if( unPackStr(player.d) == "e"&& md2rd(plong)<=100)
                {
                    radar.dline(players[trackPlayerIndex].x,players[trackPlayerIndex].y,player.x,player.y,"rgba(255,0,0,1)",3);
                }
                //100~500米内
                else if(unPackStr(player.d) == "e"&& 100<md2rd(plong)<=500)
                {
                    radar.dline(players[trackPlayerIndex].x,players[trackPlayerIndex].y,player.x,player.y,"rgba(255,160,0,1)",1.5);
                }
                //500米外
                else if(unPackStr(player.d) == "e"&& 500<md2rd(plong))
                {
                    radar.dline(players[trackPlayerIndex].x,players[trackPlayerIndex].y,player.x,player.y,"rgba(255,255,0,1)",0.5);
                }
                
            }
            if( unPackStr(player.d) == "t")
            {
                radar.dline(players[trackPlayerIndex].x,players[trackPlayerIndex].y,player.x,player.y,"rgba(0,51,"+Math.ceil(100*(1-((100 - player.h) / 100)))+",1)",1);
                //radar.undertext(player.x, player.y, unPackStr(player.n)+" "+Math.ceil(plong/102.4)+"M K:"+player.k, color);
            }
            if(150<md2rd(plong)&&i!=trackPlayerIndex)
            {
                radar.undertext(player.x, player.y, /*unPackStr(player.n)+" "+*/Math.ceil(plong/102.4)+"M"+" "+getAngle(player.x,player.y,players[trackPlayerIndex].x,players[trackPlayerIndex].y)+"°"/*+" K:"+player.k*/, color);
            }
            else if(i!=trackPlayerIndex)
            {
                //radar.undertext(player.x, player.y, /*unPackStr(player.n)+" "+Math.ceil(plong/102.4)+*//*"K:"+player.k*/, color);
            }
            
            radar.text(player.x, player.y, player.t, 'white');
            //radar.lable(player.x, player.y,unPackStr(player.n),'#fff');
        }
    }

    function drawItems() {
        if (!locations.i) {
            return;
        }
        if (!locations.p) {
            return;
        }
        var items = locations.i;
        var players = locations.p;
        for (var i = items.length - 1; i >= 0; i--) {
            var item = items[i];
            var iteminfo_i = items_iconinfo[unPackStr(item.n)];
            if(iteminfo_i!=null)
            {
                radar.diconimg(items_iconimg,item.x,item.y,iteminfo_i.offsetX,iteminfo_i.offsetY,iteminfo_i.packedWidth,iteminfo_i.packedHeight);
            }
            if(unPackStr(item.n) == "Item_Weapon_FlareGun_C")
            {
                radar.dline(locations.p[trackPlayerIndex].x,locations.p[trackPlayerIndex].y,item.x,item.y,"red",1);
            }
            
        }
    }

    function drawVehicles() {
        if (!locations.v) {
            return;
        }
        var vehicles = locations.v;
        for (var i = vehicles.length - 1; i >= 0; i--) {
            var vehicle = vehicles[i];
            //radar.text(vehicle.x, vehicle.y, unPackStr(vehicle.n), 'orange');
            //判断类型
            var plong = getP2PLong(locations.p[trackPlayerIndex].x,locations.p[trackPlayerIndex].y,vehicle.x,vehicle.y);
            if(unPackStr(vehicle.n)=="DeadBox")
            {
                radar.lable(vehicle.x, vehicle.y, 0.5,"盒子", 'rgba(149, 84, 51, 0.8)');
            }
            else if(unPackStr(vehicle.n)=="AirDrop")
            {
                radar.lable(vehicle.x, vehicle.y, 0.8,"补给箱 "+Math.round(md2rd(plong))+"M", '#0022ff');
                radar.dline(locations.p[trackPlayerIndex].x,locations.p[trackPlayerIndex].y,vehicle.x,vehicle.y,'#0022ff',0.4);
            }
            else if(unPackStr(vehicle.n)=="Parachute")
            {
                radar.dot(vehicle.x, vehicle.y, "#495A80",5);
                if(vehicle.r != 0){
                    radar.lineWithAngle(vehicle.x, vehicle.y, 15, 6, vehicle.r, "#495A80");
                }
                radar.undertext(vehicle.x, vehicle.y,"降落伞 "+Math.round(md2rd(plong))+"M", "#495A80");
            }
            else if(unPackStr(vehicle.d)=="r")
            {
                radar.dline(locations.p[trackPlayerIndex].x,locations.p[trackPlayerIndex].y,vehicle.x,vehicle.y,'rgba(149, 24, 38, 0.8)',1);
                if(translate[unPackStr(vehicle.n)]!=undefined)
                {
                    radar.lable(vehicle.x, vehicle.y, 0.8,translate[unPackStr(vehicle.n)]+" "+Math.round(md2rd(plong))+"M", 'rgba(149, 24, 38, 0.8)');
                }
                else
                {
                    radar.lable(vehicle.x, vehicle.y, 0.8,unPackStr(vehicle.n)+" "+Math.round(md2rd(plong))+"M", 'rgba(149, 24, 38, 0.8)');
                }
            }
            else if(unPackStr(vehicle.d)=="s")
            {
                if(translate[unPackStr(vehicle.n)]!=undefined)
                {
                    radar.lable(vehicle.x, vehicle.y, 0.8,translate[unPackStr(vehicle.n)]+" "+Math.round(md2rd(plong))+"M", 'rgba(149, 24, 38, 0.8)');
                }
                else
                {
                    radar.lable(vehicle.x, vehicle.y, 0.8,unPackStr(vehicle.n)+" "+Math.round(md2rd(plong))+"M", 'rgba(149, 24, 38, 0.8)');
                }
            }
            else if(unPackStr(vehicle.n)=="Plane")
            {
                radar.dot(vehicle.x, vehicle.y, "rgb(255,0,255)",5);
                radar.undertext(vehicle.x, vehicle.y,"飞机 "+Math.round(md2rd(plong))+"M", "rgb(255,0,255)");
                //radar.dline(locations.p[trackPlayerIndex].x,locations.p[trackPlayerIndex].y,vehicle.x,vehicle.y,'rgba(255,0,255, 0.2)',0.3);
            }
            else if(unPackStr(vehicle.n)=="WarningZone"&&vehicle.x!=0&&vehicle.y!=0)
            {
                
                
                if(plong>vehicle.r)
                {
                    radar.undertext(vehicle.x, vehicle.y,Math.ceil(md2rd(plong))+"M", "white");
                    radar.dline(locations.p[trackPlayerIndex].x,locations.p[trackPlayerIndex].y,vehicle.x,vehicle.y,"rgba(255,255,255,1)",2);
                    radar.Arc(vehicle.x, vehicle.y,vehicle.r,1,"rgba(255,255,255,1)","rgba(255,255,255,0.3)");
                }
                else
                {
                    radar.Arc(vehicle.x, vehicle.y,vehicle.r,1,"rgba(255,255,255,1)","rgba(0,0,0,0)");
                }
                
            }
            else if(unPackStr(vehicle.n)=="SafetyZone"&&vehicle.x!=0&&vehicle.y!=0)
            {
                //radar.dline(locations.p[trackPlayerIndex].x,locations.p[trackPlayerIndex].y,vehicle.x,vehicle.y,'blue',1);
                //radar.undertext(vehicle.x, vehicle.y,Math.ceil(plong/102.4)+"M", "red");
                radar.Arc(vehicle.x, vehicle.y,vehicle.r,1,"rgba(0,0,255,1)","rgba(0,0,0,0)");
            }
            else if(unPackStr(vehicle.n)=="RedZone"&&vehicle.x!=0&&vehicle.y!=0)
            {
                //radar.dline(locations.p[trackPlayerIndex].x,locations.p[trackPlayerIndex].y,vehicle.x,vehicle.y,'red',1);
                //radar.undertext(vehicle.x, vehicle.y,Math.ceil(plong/102.4)+"M", "red");
                radar.Arc(vehicle.x, vehicle.y,vehicle.r,1,"rgba(120,0,0,0.2)","rgba(120,0,0,0.2)");
            }

        }
    }

    function drawMisc() {
        
        $("#flash_timeinfo").text("Flash: " + socketUpdateCounter.getPerSec() + "ps Delay: "+SocketDelay+"ms")
    }

    function isInView(x,y,p_x,p_y,p_r){
        //conver to Relative coordinates
        p_x = x - p_x
        p_y = y - p_y

        angle = Math.atan2(p_y,p_x)*180/Math.PI
        if(angle<0)
        {
            angle = angle+360
        }
        if(Math.abs(p_r-angle)>=2.5)
        {
            return false;
        }
        return true;

    }
    function getAngle(s_x,s_y,t_x,t_y)
    {
        x_l = s_x - t_x
        y_l = s_y - t_y
        angle = Math.atan2(y_l,x_l)*180/Math.PI
        if(angle<0)
        {
            angle = angle+360
        }
        angle = angle+90;
        if(angle>=360)
        {
            angle = angle -360;
        }
        return Math.round(angle);
    }
    function getP2PLong(x,y,p_x,p_y){
        return Math.pow((Math.pow(x - p_x,2) + Math.pow(y - p_y,2)), 0.5)
    }

    function unPackStr(strID){
        if(strID!=-1)
        {
            return cacheStr[strID];
        }
        return "null"; 
    }
    function md2rd(md)
    {
       return md/102.4;
    }
    /*
    Array.prototype.contains = function ( needle ) {
      for (i in this) {
        if (this[i] == needle) return true;
      }
      return false;
    }*/
});
