package gaydar.web

data class Player (
    var t:Float?,
    var x:Float?,
    var y:Float?,
    var h:Float?,
    var r:Float?,
    var k:Int,
    var n:Int,
    var d:Int
)
/*
* t 队伍id
* x
* y
* h 生命值
* r 方向
* d 描述
* */
data class Item(
    var x:Float?,
    var y:Float?,
    var n:Int?
)
/*
* n 物品ID
* */
data class Vehicle(
    var x:Float?,
    var y:Float?,
    var r:Float?,
    var n:Int?,
    var d:Int?
)
/*
* n 物件ID
* d 描述
*
* */

data class MapPacketStruct(
    var m: Int ?,
    var t:String,
    var s:ArrayList<String>?,
    var p: ArrayList <Player>?,
    var i: ArrayList<Item>?,
    var v: ArrayList<Vehicle>?
)
/*
*m:MapID
*s:string
*p:players
*i:items
*v:vehicles
*/