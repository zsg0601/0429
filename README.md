# WebMap-我自己都还不会
![](static/demo.gif)

### custom reader

HTTP POST that JSON struct blow, send it to `http://127.0.0.1:7890'.

```json
{
    "locations": {
    	"m": 1,
    	"t": "token",
    	"s": ["str1","str2","str3"],
        "p": [{
            "t": 0,
            "x": 1.00,
            "y": 1.00,
            "h": 100.00,
            "r": 360.00,
            "k": 1,
            "n": 0,
            "d": 0
        }],
        "i": [{
            "x": 1.00,
            "y": 1.00,
            "n": 1
        }],
        "v": [{
            "x": 1.00,
            "y": 1.00,
            "r": 360.00,
            "n": 2,
            "d": 3
        }]
    }
}
