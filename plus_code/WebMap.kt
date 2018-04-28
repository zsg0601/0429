package gaydar.web

import com.badlogic.gdx.math.Vector2
import java.io.IOException
import okhttp3.MediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.Response
import com.google.gson.Gson
import gaydar.deserializer.channel.ActorChannel

import gaydar.isErangel
import gaydar.deserializer.channel.ActorChannel.Companion.actorHasWeapons
import gaydar.deserializer.channel.ActorChannel.Companion.actors
import gaydar.deserializer.channel.ActorChannel.Companion.airDropLocation
import gaydar.deserializer.channel.ActorChannel.Companion.corpseLocation
import gaydar.deserializer.channel.ActorChannel.Companion.droppedItemLocation
import gaydar.deserializer.channel.ActorChannel.Companion.visualActors
import gaydar.deserializer.channel.ActorChannel.Companion.weapons
import gaydar.struct.CMD.GameStateCMD.isTeamMatch
import gaydar.struct.CMD.GameStateCMD.RedZonePosition
import gaydar.struct.CMD.GameStateCMD.RedZoneRadius
import gaydar.struct.CMD.GameStateCMD.SafetyZonePosition
import gaydar.struct.CMD.GameStateCMD.SafetyZoneRadius
import gaydar.struct.Actor
import gaydar.struct.Archetype
import gaydar.struct.CMD.*
import gaydar.struct.Character
import gaydar.ui.GLMap
import gaydar.ui.GLMap.Companion.component1
import gaydar.ui.GLMap.Companion.component2
import gaydar.util.tuple4
import gaydar.web.*
import gaydar.struct.NetworkGUID
import gaydar.struct.PlayerState
import gaydar.ui.GLMap.Companion.component3
import java.util.*
import kotlin.collections.ArrayList
typealias renderInfo = tuple4<Actor, Float, Float, Float>

var webMap = WebMap();


class WebMap {
    internal var fpsTime = 60
    internal var flashTime = System.currentTimeMillis()
    internal var client = OkHttpClient()
    internal var serverUrl = "http://127.0.0.1:7890"
    internal var tokenKey = "94402e5ec6a02d0be460716f4b5acaf57482485c0ce86aab492d1d4876af3464"
    internal val JSON = MediaType.parse("application/json; charset=utf-8")
    internal var  mapID:Int? =null
    internal var gson = Gson()
    internal var teamNumberCache = 0
    internal var strs:ArrayList<String> = ArrayList(0)
    internal var lastMD5 = ""
    internal var moreneedItem = arrayListOf("Item_Weapon_FlareGun_C","Item_Ammo_Flare_C")
    private val attackLineStartTime = LinkedList<Triple<NetworkGUID, NetworkGUID, Long>>()
    @Throws(IOException::class)
    internal fun postData(json: String): String {
        val body = RequestBody.create(JSON, json)
        val request = Request.Builder()
                .url(serverUrl)
                .post(body)
                .build()
        val response = client.newCall(request).execute()
        return response.body()!!.string()
    }

    fun sendGameMsg(){
        if((System.currentTimeMillis()-flashTime)<=fpsTime)
        {
            return
        }
        else
        {
            flashTime = System.currentTimeMillis()
        }
        if(isErangel)
        {
            this.mapID = 1;
        }
        else
        {
            this.mapID = 2;
        }
        actors[ActorChannel.selfID]?.apply {
            actors[attachParent ?: return@apply]?.apply {
                selfCoords.set(location.x, location.y, location.z)
                selfDirection = rotation.y
            }
        }
        val selfX = selfCoords.x
        val selfY = selfCoords.y
        val selfPlayerState = getSelfState()
        val items= ArrayList<Item>(0)
        val players= ArrayList<Player>(0)
        val vehicles = ArrayList<Vehicle>(0)
        corpseLocation.values.forEach {
            val (x, y) = it
            vehicles.add(Vehicle(x.toFloat(),y.toFloat(),0.toFloat(),packStr("DeadBox"),packStr("d")))
        }
        airDropLocation.values.forEach {
            val (x, y) = it
            vehicles.add(Vehicle(x.toFloat(),y.toFloat(),0.toFloat(),packStr("AirDrop"),packStr("a")))
        }
        val typeLocation = EnumMap<Archetype, MutableList<renderInfo>>(Archetype::class.java)
        for ((_, actor) in visualActors)
            typeLocation.compute(actor.type) { _, v ->
                val list = v ?: ArrayList()
                val (centerX, centerY) = actor.location
                val direction = actor.rotation.y
                list.add(tuple4(actor, centerX, centerY, direction))
                list
            }
        if(selfPlayerState.teamNumber!=0)
        {
            teamNumberCache = selfPlayerState.teamNumber
        }
        players.add(Player(teamNumberCache.toFloat(),selfX.toFloat(),selfY.toFloat(),100.toFloat(), selfDirection.toFloat(),selfPlayerState.numKills,packStr(selfPlayerState.name),packStr("t")))
        for ((type, actorInfos) in typeLocation) {
            when (type) {
                Archetype.Player -> actorInfos?.forEach {
                    for ((_, _) in typeLocation) {
                        val (actor, x, y, dir) = it
                        val playerStateGUID = (actor as? Character)?.playerStateID ?: return@forEach
                        val PlayerState= actors[playerStateGUID] as? PlayerState ?: return@forEach
                        val teamNumber = PlayerState.teamNumber
                        val health = CharacterCMD.actorHealth[actor.netGUID] ?: 100f
                        val numKills = PlayerState.numKills
                        val name = PlayerState.name
                        if (teamNumber == teamNumberCache) {
                            val player = Player(teamNumber.toFloat(),x.toFloat(),y.toFloat(),health.toFloat(),dir.toFloat(),numKills,packStr(name),packStr("t"))
                            val flag =  players.indexOf(player)
                            if(flag==-1)
                            {
                                players.add( 1,player)
                            }
                        }
                        else {
                            val player = Player(teamNumber.toFloat(),x.toFloat(),y.toFloat(),health.toFloat(),dir.toFloat(),numKills,packStr(name),packStr("e"))
                            val flag =  players.indexOf(player)
                            if(flag==-1)
                            {
                                players.add( player)
                            }
                        }
                    }
                }
                Archetype.Parachute -> actorInfos?.forEach {
                    for ((_, _) in typeLocation) {
                        val (_, x, y, dir) = it
                        val vehicle = Vehicle(x.toFloat(),y.toFloat(),dir.toFloat(),packStr("Parachute"),-1)
                        val flag =  vehicles.indexOf(vehicle)
                        if(flag==-1)
                        {
                            vehicles.add(vehicle)
                        }
                    }
                }
                Archetype.TwoSeatBoat-> actorInfos?.forEach {
                    val (actor, x, y, dir) = it
                    val v_x = actor!!.velocity.x
                    val v_y = actor.velocity.y
                    if (actor.attachChildren.isNotEmpty() || v_x * v_x + v_y * v_y > 40) {
                        vehicles.add(Vehicle(x,y,dir,packStr("TwoSeatBoat"),packStr("r")))
                    }
                    else
                    {
                        vehicles.add(Vehicle(x,y,dir,packStr("TwoSeatBoat"),packStr("s")))
                    }
                }
                Archetype.SixSeatBoat-> actorInfos?.forEach {
                    val (actor, x, y, dir) = it
                    val v_x = actor!!.velocity.x
                    val v_y = actor.velocity.y
                    if (actor.attachChildren.isNotEmpty() || v_x * v_x + v_y * v_y > 40) {
                        vehicles.add(Vehicle(x,y,dir,packStr("SixSeatBoat"),packStr("r")))
                    }
                    else
                    {
                        vehicles.add(Vehicle(x,y,dir,packStr("SixSeatBoat"),packStr("s")))
                    }
                }
                Archetype.Dacia-> actorInfos?.forEach {
                    val (actor, x, y, dir) = it
                    val v_x = actor!!.velocity.x
                    val v_y = actor.velocity.y
                    if (actor.attachChildren.isNotEmpty() || v_x * v_x + v_y * v_y > 40) {
                        vehicles.add(Vehicle(x,y,dir,packStr("Dacia"),packStr("r")))
                    }
                    else
                    {
                        vehicles.add(Vehicle(x,y,dir,packStr("Dacia"),packStr("s")))
                    }
                }
                Archetype.Uaz-> actorInfos?.forEach {
                    val (actor, x, y, dir) = it
                    val v_x = actor!!.velocity.x
                    val v_y = actor.velocity.y
                    if (actor.attachChildren.isNotEmpty() || v_x * v_x + v_y * v_y > 40) {
                        vehicles.add(Vehicle(x,y,dir,packStr("Uaz"),packStr("r")))
                    }
                    else
                    {
                        vehicles.add(Vehicle(x,y,dir,packStr("Uaz"),packStr("s")))
                    }
                }
                Archetype.Pickup-> actorInfos?.forEach {
                    val (actor, x, y, dir) = it
                    val v_x = actor!!.velocity.x
                    val v_y = actor.velocity.y
                    if (actor.attachChildren.isNotEmpty() || v_x * v_x + v_y * v_y > 40) {
                        vehicles.add(Vehicle(x,y,dir,packStr("Pickup"),packStr("r")))
                    }
                    else
                    {
                        vehicles.add(Vehicle(x,y,dir,packStr("Pickup"),packStr("s")))
                    }
                }
                Archetype.Buggy-> actorInfos?.forEach {
                    val (actor, x, y, dir) = it
                    val v_x = actor!!.velocity.x
                    val v_y = actor.velocity.y
                    if (actor.attachChildren.isNotEmpty() || v_x * v_x + v_y * v_y > 40) {
                        vehicles.add(Vehicle(x,y,dir,packStr("Buggy"),packStr("r")))
                    }
                    else
                    {
                        vehicles.add(Vehicle(x,y,dir,packStr("Buggy"),packStr("s")))
                    }
                }
                Archetype.Bike-> actorInfos?.forEach {
                    val (actor, x, y, dir) = it
                    val v_x = actor!!.velocity.x
                    val v_y = actor.velocity.y
                    if (actor.attachChildren.isNotEmpty() || v_x * v_x + v_y * v_y > 40) {
                        vehicles.add(Vehicle(x,y,dir,packStr("Bike"),packStr("r")))
                    }
                    else
                    {
                        vehicles.add(Vehicle(x,y,dir,packStr("Bike"),packStr("s")))
                    }
                }
                Archetype.SideCar-> actorInfos?.forEach {
                    val (actor, x, y, dir) = it
                    val v_x = actor!!.velocity.x
                    val v_y = actor.velocity.y
                    if (actor.attachChildren.isNotEmpty() || v_x * v_x + v_y * v_y > 40) {
                        vehicles.add(Vehicle(x,y,dir,packStr("SideCar"),packStr("r")))
                    }
                    else
                    {
                        vehicles.add(Vehicle(x,y,dir,packStr("SideCar"),packStr("s")))
                    }
                }
                Archetype.Bus-> actorInfos?.forEach {
                    val (actor, x, y, dir) = it
                    val v_x = actor!!.velocity.x
                    val v_y = actor.velocity.y
                    if (actor.attachChildren.isNotEmpty() || v_x * v_x + v_y * v_y > 40) {
                        vehicles.add(Vehicle(x,y,dir,packStr("Bus"),packStr("r")))
                    }
                    else
                    {
                        vehicles.add(Vehicle(x,y,dir,packStr("Bus"),packStr("s")))
                    }
                }
                Archetype.Plane -> actorInfos?.forEach {
                    for ((_, _) in typeLocation) {
                        val (_, x, y, dir) = it
                        val vehicle = Vehicle(x.toFloat(),y.toFloat(),dir.toFloat(),packStr("Plane"),-1)
                        vehicles.add(vehicle)
                    }
                }
                Archetype.Grenade -> actorInfos?.forEach {
                    val (_, x, y, dir) = it
                    val (sx, sy) = Vector2(x, y)
                    vehicles.add(Vehicle(x,y,dir,packStr("Grenade"),packStr("r")))
                }

            }
        }
        vehicles.add(Vehicle(RedZonePosition.x,RedZonePosition.y,RedZoneRadius,packStr("RedZone"),-1))
        vehicles.add(Vehicle(SafetyZonePosition.x,SafetyZonePosition.y,SafetyZoneRadius,packStr("SafetyZone"),-1))
        vehicles.add(Vehicle(GameStateCMD.PoisonGasWarningPosition.x, GameStateCMD.PoisonGasWarningPosition.y, GameStateCMD.PoisonGasWarningRadius,packStr("WarningZone"),-1))
          //获取物品数据根据Play坐标
        droppedItemLocation.values.forEach {
            val (x, y, itemHeight) = it._1
            val name:String = it._2
            for (i in 0 until players.count()) {
                if(players[i].t==teamNumberCache.toFloat())/*name in needItems*/
                {
                    if(md2rd(getP2PLong(x,players[i].x!!,y,players[i].y!!))<=75)
                    {
                        items.add(Item(x.toFloat() ,y.toFloat(),packStr(name)))
                        break
                    }
                    else if(name in moreneedItem)
                    {
                        items.add(Item(x.toFloat() ,y.toFloat(),packStr(name)))
                        break
                    }
                }
            }

        }

        val locations = MapPacketStruct(mapID,tokenKey,strs,players,items,vehicles)
        val jsonData = gson.toJson(locations)
        val md5 = encode(jsonData)
        if(md5==lastMD5)
        {
            return
        }
        else
        {
            lastMD5 = md5
        }
        try {
            postData(jsonData)
        }
        catch (e:Exception)
        {
            println(e)
        }

        //println(jsonData.length)

    }

    fun getSelfState():PlayerState{
        actors[ActorChannel.selfID]?.apply {
            val playerStateGUID = ActorCMD.actorWithPlayerState[netGUID]
            val PlayerState= actors[playerStateGUID] as? PlayerState ?: return PlayerState(NetworkGUID(0),Archetype.Player,"null")
            return PlayerState
        }
        return PlayerState(NetworkGUID(0),Archetype.Player,"null")
    }
    fun getP2PLong(a_x:Float,b_x:Float,a_y:Float,b_y:Float):Float{
        val x = Math.pow((a_x-b_x).toDouble(),2.toDouble())
        val y = Math.pow((a_y-b_y).toDouble(),2.toDouble())
        return Math.pow(x+y,0.5.toDouble()).toFloat()
    }

    fun packStr(str:String):Int
    {
        if(str !in strs)
        {
            strs.add(str)
        }
       return strs.indexOf(str)
    }
    fun unPackStr(id:Int):String{
        if(id != -1)
        {
            return strs[id]
        }
        return "null"
    }
    fun md2rd(d:Float):Float
    {
        return d/102.4f
    }
    fun encode(text: String): String {
        try {
            //获取md5加密对象
            val instance: java.security.MessageDigest = java.security.MessageDigest.getInstance("MD5")
            //对字符串加密，返回字节数组
            val digest:ByteArray = instance.digest(text.toByteArray())
            var sb : StringBuffer = StringBuffer()
            for (b in digest) {
                //获取低八位有效值
                var i :Int = b.toInt() and 0xff
                //将整数转化为16进制
                var hexString = Integer.toHexString(i)
                if (hexString.length < 2) {
                    //如果是一位的话，补0
                    hexString = "0" + hexString
                }
                sb.append(hexString)
            }
            return sb.toString()

        } catch (e: Exception) {
            e.printStackTrace()
        }

        return ""
    }
}