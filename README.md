Sick an tired
=============

Getting the latest race details is a game of luck. Let's tip the scales in our favour.

How To
------

HTTP GET: `http://www.entrycentral.com/front_page_table_ajax.php`

with the following cookies set:

* `filter_bike_check`: `checked`
* `filter_distance_switch`: `on`
* `filter_distance_amount`: `100`
* `filter_distance_postcode`: `BT1`

should return..

```
{
    "sEcho": 0,
    "iTotalRecords": "310",
    "iTotalDisplayRecords": "2",
    "aaData": [
        [
            "<a href=index.php?raceID=100180>NDCC Bangor Coastal Challenge</a>",
            "16/06/2013",
            "Open",
            "12/06/2013",
            9
        ],
        [
            "<a href=index.php?festivalID=339>Spires CC Magherafelt Grand Prix</a>",
            "02/03/2013",
            "Open",
            "01/03/2013",
            27
        ]
    ]
}
```

The `aaData` fields appear to align to:

1. HTML link
2. Event date
3. Signup status
4. Entry closing date
5. Distance
