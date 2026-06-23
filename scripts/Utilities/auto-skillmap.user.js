// ==UserScript==
// @name         Auto Skill Pro (v17.0 - F27+F31+MaxCases)
// @namespace    http://tampermonkey.net/
// @version      17.0
// @description  Auto skillmaps
// @author       Jamie
// @credits      Huge credit to ChunkyCheese
// @match        https://case-clicker.com/*
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    // ----------------------------------------------------------------------------------
    //  STEP 1: DATA (Verified against Raw Site JSON)
    // ----------------------------------------------------------------------------------
    const allSkillData = {
        "Dust II": { skills: [] }, "Mirage": { skills: [] }, "Inferno": { skills: [] },
        "Ancient": { skills: [] }, "Anubis": { skills: [] }, "Cobblestone": { skills: [] }
    };

    // Dust II
    allSkillData["Dust II"].skills = [
        {"id":"a1","nextSkillIds":["a2","a10"],"requiredPrevSkillId":null,"cost":1,"name":"CT Spawn","rewards":["15;0.1"]},
        {"id":"a2","nextSkillIds":["a3","a6"],"requiredPrevSkillId":"a1","cost":5,"name":"CT Mid","rewards":["15;0.1"]},
        {"id":"a3","nextSkillIds":["a4"],"requiredPrevSkillId":"a2","cost":10,"name":"B Window","rewards":["15;0.1"]},
        {"id":"a4","nextSkillIds":["a5"],"requiredPrevSkillId":"a3","cost":10,"name":"Double","rewards":["11;0.002"]},
        {"id":"a5","nextSkillIds":[],"requiredPrevSkillId":"a4","cost":50,"name":"Back Plat","rewards":["11;0.002","15;0.1","13;10"]},
        {"id":"a6","nextSkillIds":["a7"],"requiredPrevSkillId":"a2","cost":10,"name":"B Doors","rewards":["15;0.05"]},
        {"id":"a7","nextSkillIds":["a8"],"requiredPrevSkillId":"a6","cost":10,"name":"B Car","rewards":["15;0.05"]},
        {"id":"a8","nextSkillIds":["a9"],"requiredPrevSkillId":"a7","cost":10,"name":"Big Box","rewards":["13;10"]},
        {"id":"a9","nextSkillIds":[],"requiredPrevSkillId":"a8","cost":10,"name":"Fence","rewards":["13;10"]},
        {"id":"a10","nextSkillIds":["a11","a13"],"requiredPrevSkillId":"a1","cost":10,"name":"A Long Car","rewards":["11;0.002"]},
        {"id":"a11","nextSkillIds":["a12"],"requiredPrevSkillId":"a10","cost":25,"name":"A Long Corner","rewards":["13;20"]},
        {"id":"a12","nextSkillIds":[],"requiredPrevSkillId":"a11","cost":50,"name":"A Long Pit","rewards":["13;20","14;2.5"]},
        {"id":"a13","nextSkillIds":["a14"],"requiredPrevSkillId":"a10","cost":10,"name":"A Ramp","rewards":["13;5"]},
        {"id":"a14","nextSkillIds":["a15"],"requiredPrevSkillId":"a13","cost":10,"name":"Safe","rewards":["14;2.5"]},
        {"id":"a15","nextSkillIds":[],"requiredPrevSkillId":"a14","cost":10,"name":"Goose","rewards":["15;0.2"]},
        {"id":"a16","nextSkillIds":["a17","a24","a26"],"requiredPrevSkillId":null,"cost":1,"name":"T Spawn","rewards":["11;0.002"]},
        {"id":"a17","nextSkillIds":["a18"],"requiredPrevSkillId":"a16","cost":20,"name":"Suicide","rewards":["16;50"]},
        {"id":"a18","nextSkillIds":["a19","a21"],"requiredPrevSkillId":"a17","cost":20,"name":"Top Mid","rewards":["15;0.2"]},
        {"id":"a19","nextSkillIds":["a20"],"requiredPrevSkillId":"a18","cost":20,"name":"Middle","rewards":["15;0.2"]},
        {"id":"a20","nextSkillIds":[],"requiredPrevSkillId":"a19","cost":50,"name":"Xbox","rewards":["13;20","14;2.5"]},
        {"id":"a21","nextSkillIds":["a22"],"requiredPrevSkillId":"a18","cost":10,"name":"Catwalk","rewards":["11;0.002"]},
        {"id":"a22","nextSkillIds":["a23"],"requiredPrevSkillId":"a21","cost":10,"name":"A Short Stairs","rewards":["11;0.002"]},
        {"id":"a23","nextSkillIds":[],"requiredPrevSkillId":"a22","cost":25,"name":"Ninja","rewards":["15;0.2"]},
        {"id":"a24","nextSkillIds":["a25"],"requiredPrevSkillId":"a16","cost":10,"name":"A Long Entrance","rewards":["11;0.001"]},
        {"id":"a25","nextSkillIds":[],"requiredPrevSkillId":"a24","cost":10,"name":"A Long Connector","rewards":["11;0.001"]},
        {"id":"a26","nextSkillIds":["a27"],"requiredPrevSkillId":"a16","cost":10,"name":"Football","rewards":["13;10"]},
        {"id":"a27","nextSkillIds":["a28"],"requiredPrevSkillId":"a26","cost":10,"name":"B Tunnels Entrance","rewards":["13;10"]},
        {"id":"a28","nextSkillIds":["a29"],"requiredPrevSkillId":"a27","cost":20,"name":"B Tunnels","rewards":["13;10"]},
        {"id":"a29","nextSkillIds":[],"requiredPrevSkillId":"a28","cost":50,"name":"Lower Tunnels","rewards":["15;0.2","13;20","14;2.5","11;0.001"]}
    ];

    // Mirage
    allSkillData["Mirage"].skills = [
        {"id":"b1","nextSkillIds":["b2","b8","b11"],"requiredPrevSkillId":null,"cost":10,"name":"CT Spawn","rewards":["15;0.15"]},
        {"id":"b2","nextSkillIds":["b3","b6"],"requiredPrevSkillId":"b1","cost":30,"name":"Ticket","rewards":["11;0.005"]},
        {"id":"b3","nextSkillIds":["b4"],"requiredPrevSkillId":"b2","cost":30,"name":"Tripple","rewards":["11;0.002"]},
        {"id":"b4","nextSkillIds":["b5"],"requiredPrevSkillId":"b3","cost":40,"name":"Palm","rewards":["11;0.002"]},
        {"id":"b5","nextSkillIds":[],"requiredPrevSkillId":"b4","cost":100,"name":"Stairs","rewards":["11;0.005","15;0.5"]},
        {"id":"b6","nextSkillIds":["b7"],"requiredPrevSkillId":"b2","cost":30,"name":"A Default","rewards":["14;5"]},
        {"id":"b7","nextSkillIds":[],"requiredPrevSkillId":"b6","cost":50,"name":"Fire Box","rewards":["13;25"]},
        {"id":"b8","nextSkillIds":["b9","b10"],"requiredPrevSkillId":"b1","cost":20,"name":"Vent","rewards":["13;25"]},
        {"id":"b9","nextSkillIds":[],"requiredPrevSkillId":"b8","cost":30,"name":"Window","rewards":["13;25"]},
        {"id":"b10","nextSkillIds":[],"requiredPrevSkillId":"b8","cost":30,"name":"Jungle","rewards":["14;5"]},
        {"id":"b11","nextSkillIds":["b12","b15"],"requiredPrevSkillId":"b1","cost":50,"name":"Market","rewards":["16;100"]},
        {"id":"b12","nextSkillIds":["b13"],"requiredPrevSkillId":"b11","cost":30,"name":"Market Window","rewards":["15;0.5"]},
        {"id":"b13","nextSkillIds":["b14"],"requiredPrevSkillId":"b12","cost":30,"name":"E Box","rewards":["15;0.5"]},
        {"id":"b14","nextSkillIds":[],"requiredPrevSkillId":"b13","cost":100,"name":"Pillar","rewards":["15;1","11;0.005"]},
        {"id":"b15","nextSkillIds":["b16"],"requiredPrevSkillId":"b11","cost":30,"name":"Market Door","rewards":["15;0.5"]},
        {"id":"b16","nextSkillIds":["b17"],"requiredPrevSkillId":"b15","cost":30,"name":"B Bench","rewards":["11;0.005"]},
        {"id":"b17","nextSkillIds":[],"requiredPrevSkillId":"b16","cost":300,"name":"Van","rewards":["15;2","11;0.005"]},
        {"id":"b18","nextSkillIds":["b19","b23","b25","b31"],"requiredPrevSkillId":null,"cost":10,"name":"T Spawn","rewards":["13;10"]},
        {"id":"b19","nextSkillIds":["b20"],"requiredPrevSkillId":"b18","cost":30,"name":"T Roof","rewards":["14;2.5"]},
        {"id":"b20","nextSkillIds":["b21"],"requiredPrevSkillId":"b19","cost":30,"name":"T Ramp","rewards":["14;2.5"]},
        {"id":"b21","nextSkillIds":["b22"],"requiredPrevSkillId":"b20","cost":50,"name":"Tetris","rewards":["13;50"]},
        {"id":"b22","nextSkillIds":[],"requiredPrevSkillId":"b21","cost":300,"name":"Sandwich","rewards":["13;100","14;5"]},
        {"id":"b23","nextSkillIds":["b24"],"requiredPrevSkillId":"b18","cost":30,"name":"Palace","rewards":["11;0.005"]},
        {"id":"b24","nextSkillIds":[],"requiredPrevSkillId":"b23","cost":30,"name":"Balcony","rewards":["11;0.005"]},
        {"id":"b25","nextSkillIds":["b26","b29"],"requiredPrevSkillId":"b18","cost":30,"name":"Top Mid","rewards":["15;0.5"]},
        {"id":"b26","nextSkillIds":["b27"],"requiredPrevSkillId":"b25","cost":30,"name":"Chair","rewards":["11;0.005"]},
        {"id":"b27","nextSkillIds":["b28"],"requiredPrevSkillId":"b26","cost":30,"name":"Middle","rewards":["14;2.5"]},
        {"id":"b28","nextSkillIds":[],"requiredPrevSkillId":"b27","cost":200,"name":"A Connector","rewards":["11;0.005","13;25","14;5","15;1"]},
        {"id":"b29","nextSkillIds":["b30"],"requiredPrevSkillId":"b25","cost":30,"name":"Catwalk","rewards":["13;10"]},
        {"id":"b30","nextSkillIds":[],"requiredPrevSkillId":"b29","cost":100,"name":"Ladder Room","rewards":["13;50","14;5"]},
        {"id":"b31","nextSkillIds":["b32"],"requiredPrevSkillId":"b18","cost":30,"name":"T Apartments","rewards":["11;0.005"]},
        {"id":"b32","nextSkillIds":["b33","b34"],"requiredPrevSkillId":"b31","cost":30,"name":"Alley","rewards":["11;0.005"]},
        {"id":"b33","nextSkillIds":[],"requiredPrevSkillId":"b32","cost":30,"name":"Underpass","rewards":["11;0.005"]},
        {"id":"b34","nextSkillIds":[],"requiredPrevSkillId":"b32","cost":30,"name":"Apartments","rewards":["11;0.005"]}
    ];

    // Inferno
    allSkillData["Inferno"].skills = [
        {"id":"c1","nextSkillIds":["c2","c6"],"requiredPrevSkillId":null,"cost":50,"name":"T Spawn","rewards":["15;0.3"]},
        {"id":"c2","nextSkillIds":["c3","c4","c5"],"requiredPrevSkillId":"c1","cost":100,"name":"T Ramp","rewards":["11;0.005"]},
        {"id":"c3","nextSkillIds":[],"requiredPrevSkillId":"c2","cost":100,"name":"Banana","rewards":["11;0.005"]},
        {"id":"c4","nextSkillIds":[],"requiredPrevSkillId":"c2","cost":100,"name":"Middle","rewards":["11;0.005"]},
        {"id":"c5","nextSkillIds":[],"requiredPrevSkillId":"c2","cost":100,"name":"Underpass","rewards":["11;0.005"]},
        {"id":"c6","nextSkillIds":["c7"],"requiredPrevSkillId":"c1","cost":100,"name":"Radio","rewards":["14;5"]},
        {"id":"c7","nextSkillIds":["c8"],"requiredPrevSkillId":"c6","cost":100,"name":"T Arches","rewards":["14;5"]},
        {"id":"c8","nextSkillIds":["c9"],"requiredPrevSkillId":"c7","cost":100,"name":"Second Middle","rewards":["13;25"]},
        {"id":"c9","nextSkillIds":["c10"],"requiredPrevSkillId":"c8","cost":100,"name":"Squeaky","rewards":["13;25"]},
        {"id":"c10","nextSkillIds":["c11"],"requiredPrevSkillId":"c9","cost":200,"name":"Back Alley","rewards":["16;200"]},
        {"id":"c11","nextSkillIds":["c12"],"requiredPrevSkillId":"c10","cost":200,"name":"Apartments Corridor","rewards":["11;0.005"]},
        {"id":"c12","nextSkillIds":[],"requiredPrevSkillId":"c11","cost":1000,"name":"Balcony","rewards":["13;300","14;20"]},
        {"id":"c13","nextSkillIds":["c14","c24","c30"],"requiredPrevSkillId":null,"cost":50,"name":"CT Spawn","rewards":["11;0.002"]},
        {"id":"c14","nextSkillIds":["c15"],"requiredPrevSkillId":"c13","cost":100,"name":"Well","rewards":["11;0.005"]},
        {"id":"c15","nextSkillIds":["c16","c18","c20"],"requiredPrevSkillId":"c14","cost":300,"name":"Tree","rewards":["16;200"]},
        {"id":"c16","nextSkillIds":["c17"],"requiredPrevSkillId":"c15","cost":200,"name":"Sandbags","rewards":["15;1"]},
        {"id":"c17","nextSkillIds":[],"requiredPrevSkillId":"c16","cost":200,"name":"Car","rewards":["15;1"]},
        {"id":"c18","nextSkillIds":["c19"],"requiredPrevSkillId":"c15","cost":100,"name":"Church","rewards":["11;0.005"]},
        {"id":"c19","nextSkillIds":[],"requiredPrevSkillId":"c18","cost":500,"name":"Coffins","rewards":["11;0.01"]},
        {"id":"c20","nextSkillIds":["c21"],"requiredPrevSkillId":"c15","cost":100,"name":"Pool","rewards":["16;100"]},
        {"id":"c21","nextSkillIds":["c22"],"requiredPrevSkillId":"c20","cost":300,"name":"Oranges","rewards":["11;0.01"]},
        {"id":"c22","nextSkillIds":["c23"],"requiredPrevSkillId":"c21","cost":500,"name":"B New Box","rewards":["11;0.01"]},
        {"id":"c23","nextSkillIds":[],"requiredPrevSkillId":"c22","cost":2000,"name":"B Dark","rewards":["11;0.01","15;1","13;100","14;5"]},
        {"id":"c24","nextSkillIds":["c25"],"requiredPrevSkillId":"c13","cost":100,"name":"Arch","rewards":["15;1"]},
        {"id":"c25","nextSkillIds":["c26"],"requiredPrevSkillId":"c24","cost":100,"name":"A Long","rewards":["11;0.005"]},
        {"id":"c26","nextSkillIds":["c27"],"requiredPrevSkillId":"c25","cost":100,"name":"Long Cubby","rewards":["13;25"]},
        {"id":"c27","nextSkillIds":["c28"],"requiredPrevSkillId":"c26","cost":200,"name":"Top Mid","rewards":["14;5"]},
        {"id":"c28","nextSkillIds":["c29"],"requiredPrevSkillId":"c27","cost":300,"name":"Apartments Boiler","rewards":["16;100"]},
        {"id":"c29","nextSkillIds":[],"requiredPrevSkillId":"c28","cost":1000,"name":"Apartments Bedroom","rewards":["11;0.005","13;25","14;5","15;1","16;100"]},
        {"id":"c30","nextSkillIds":["c31"],"requiredPrevSkillId":"c13","cost":100,"name":"Library","rewards":["15;0.5"]},
        {"id":"c31","nextSkillIds":["c32","c33","c34"],"requiredPrevSkillId":"c30","cost":100,"name":"Moto","rewards":["15;0.5"]},
        {"id":"c32","nextSkillIds":[],"requiredPrevSkillId":"c31","cost":100,"name":"Graveyard","rewards":["11;0.005"]},
        {"id":"c33","nextSkillIds":[],"requiredPrevSkillId":"c31","cost":100,"name":"Pit","rewards":["11;0.005"]},
        {"id":"c34","nextSkillIds":["c35"],"requiredPrevSkillId":"c31","cost":200,"name":"A Short","rewards":["15;1"]},
        {"id":"c35","nextSkillIds":[],"requiredPrevSkillId":"c34","cost":200,"name":"Quad","rewards":["15;1"]}
    ];

    // Ancient
    allSkillData["Ancient"].skills = [
        {"id":"d1","nextSkillIds":["d2","d7","d8"],"requiredPrevSkillId":null,"cost":500,"name":"CT Spawn","rewards":["15;0.5"]},
        {"id":"d2","nextSkillIds":["d3"],"requiredPrevSkillId":"d1","cost":1000,"name":"Temple","rewards":["15;0.5"]},
        {"id":"d3","nextSkillIds":["d4","d5","d6"],"requiredPrevSkillId":"d2","cost":1000,"name":"Box","rewards":["16;250"]},
        {"id":"d4","nextSkillIds":[],"requiredPrevSkillId":"d3","cost":1000,"name":"A Plat","rewards":["11;0.01"]},
        {"id":"d5","nextSkillIds":[],"requiredPrevSkillId":"d3","cost":1000,"name":"Flowers","rewards":["15;1"]},
        {"id":"d6","nextSkillIds":[],"requiredPrevSkillId":"d3","cost":1000,"name":"Triple","rewards":["14;10"]},
        {"id":"d7","nextSkillIds":[],"requiredPrevSkillId":"d1","cost":5000,"name":"Sniper's Nest","rewards":["16;1000"]},
        {"id":"d8","nextSkillIds":["d9","d12"],"requiredPrevSkillId":"d1","cost":1000,"name":"Back Square","rewards":["11;0.005"]},
        {"id":"d9","nextSkillIds":["d10","d11"],"requiredPrevSkillId":"d8","cost":1000,"name":"Left Square","rewards":["11;0.005"]},
        {"id":"d10","nextSkillIds":[],"requiredPrevSkillId":"d9","cost":1000,"name":"Cave","rewards":["11;0.005"]},
        {"id":"d11","nextSkillIds":[],"requiredPrevSkillId":"d9","cost":2500,"name":"Dark","rewards":["11;0.005","15;1"]},
        {"id":"d12","nextSkillIds":[],"requiredPrevSkillId":"d8","cost":1000,"name":"Right Square","rewards":["13;50"]},
        {"id":"d13","nextSkillIds":["d14","d18","d24"],"requiredPrevSkillId":null,"cost":500,"name":"T Spawn","rewards":["16;100"]},
        {"id":"d14","nextSkillIds":["d15"],"requiredPrevSkillId":"d13","cost":1000,"name":"T Tunnel","rewards":["15;1"]},
        {"id":"d15","nextSkillIds":["d16"],"requiredPrevSkillId":"d14","cost":1000,"name":"Ruins","rewards":["15;1"]},
        {"id":"d16","nextSkillIds":["d17"],"requiredPrevSkillId":"d15","cost":1000,"name":"B Doors","rewards":["11;0.01"]},
        {"id":"d17","nextSkillIds":[],"requiredPrevSkillId":"d16","cost":10000,"name":"B Ramp","rewards":["17;3","15;1","11;0.01"]},
        {"id":"d18","nextSkillIds":["d19","d21"],"requiredPrevSkillId":"d13","cost":1000,"name":"T Entrance","rewards":["13;50"]},
        {"id":"d19","nextSkillIds":["d20","d23"],"requiredPrevSkillId":"d18","cost":1000,"name":"Middle","rewards":["14;10"]},
        {"id":"d20","nextSkillIds":[],"requiredPrevSkillId":"d19","cost":1000,"name":"Mid Cubby","rewards":["11;0.005"]},
        {"id":"d21","nextSkillIds":["d22"],"requiredPrevSkillId":"d18","cost":1000,"name":"Upper Mid","rewards":["15;1"]},
        {"id":"d22","nextSkillIds":[],"requiredPrevSkillId":"d21","cost":1000,"name":"Jaguar","rewards":["13;100"]},
        {"id":"d23","nextSkillIds":[],"requiredPrevSkillId":"d19","cost":10000,"name":"Donut","rewards":["17;2","13;200","14;10"]},
        {"id":"d24","nextSkillIds":["d25"],"requiredPrevSkillId":"d13","cost":1000,"name":"Outside","rewards":["15;1"]},
        {"id":"d25","nextSkillIds":[],"requiredPrevSkillId":"d24","cost":1000,"name":"A Main","rewards":["15;1"]}
    ];

    // Anubis
    allSkillData["Anubis"].skills = [
        {"id":"e1","nextSkillIds":["e2","e6"],"requiredPrevSkillId":null,"cost":5000,"name":"T Spawn","rewards":["11;0.005"]},
        {"id":"e2","nextSkillIds":["e3"],"requiredPrevSkillId":"e1","cost":10000,"name":"Trash","rewards":["16;1000"]},
        {"id":"e3","nextSkillIds":["e4"],"requiredPrevSkillId":"e2","cost":10000,"name":"Upper Long","rewards":["11;0.005"]},
        {"id":"e4","nextSkillIds":["e5"],"requiredPrevSkillId":"e3","cost":10000,"name":"Lower Long","rewards":["11;0.005"]},
        {"id":"e5","nextSkillIds":[],"requiredPrevSkillId":"e4","cost":10000,"name":"B Main","rewards":["11;0.02"]},
        {"id":"e6","nextSkillIds":["e7","e10"],"requiredPrevSkillId":"e1","cost":10000,"name":"Beans","rewards":["15;1"]},
        {"id":"e7","nextSkillIds":["e8"],"requiredPrevSkillId":"e6","cost":10000,"name":"T Connector","rewards":["13;250"]},
        {"id":"e8","nextSkillIds":["e9"],"requiredPrevSkillId":"e7","cost":10000,"name":"T Bridge","rewards":["13;250"]},
        {"id":"e9","nextSkillIds":[],"requiredPrevSkillId":"e8","cost":10000,"name":"Bridge","rewards":["14;20"]},
        {"id":"e10","nextSkillIds":["e11","e15"],"requiredPrevSkillId":"e6","cost":10000,"name":"Street","rewards":["16;250"]},
        {"id":"e11","nextSkillIds":["e12"],"requiredPrevSkillId":"e10","cost":10000,"name":"Stairs","rewards":["15;2"]},
        {"id":"e12","nextSkillIds":["e13"],"requiredPrevSkillId":"e11","cost":10000,"name":"Arches","rewards":["11;0.005"]},
        {"id":"e13","nextSkillIds":["e14"],"requiredPrevSkillId":"e12","cost":10000,"name":"Canal","rewards":["13;200"]},
        {"id":"e14","nextSkillIds":[],"requiredPrevSkillId":"e13","cost":10000,"name":"B Connector","rewards":["17;2"]},
        {"id":"e15","nextSkillIds":["e16"],"requiredPrevSkillId":"e10","cost":10000,"name":"Drop","rewards":["15;2"]},
        {"id":"e16","nextSkillIds":["e17"],"requiredPrevSkillId":"e15","cost":10000,"name":"Water","rewards":["11;0.01"]},
        {"id":"e17","nextSkillIds":["e18"],"requiredPrevSkillId":"e16","cost":10000,"name":"A Main","rewards":["14;20"]},
        {"id":"e18","nextSkillIds":[],"requiredPrevSkillId":"e17","cost":50000,"name":"Plat","rewards":["17;3","15;2"]},
        {"id":"e19","nextSkillIds":["e20","e24","e37","e38"],"requiredPrevSkillId":null,"cost":5000,"name":"CT Spawn","rewards":["13;100"]},
        {"id":"e20","nextSkillIds":["e21"],"requiredPrevSkillId":"e19","cost":20000,"name":"Beach","rewards":["16;500"]},
        {"id":"e21","nextSkillIds":["e22"],"requiredPrevSkillId":"e20","cost":20000,"name":"Tunnel","rewards":["16;500"]},
        {"id":"e22","nextSkillIds":["e23"],"requiredPrevSkillId":"e21","cost":20000,"name":"A Heaven","rewards":["16;500"]},
        {"id":"e23","nextSkillIds":[],"requiredPrevSkillId":"e22","cost":20000,"name":"Gate","rewards":["16;500"]},
        {"id":"e24","nextSkillIds":["e25","e33"],"requiredPrevSkillId":"e19","cost":10000,"name":"CT Mid","rewards":["13;250"]},
        {"id":"e25","nextSkillIds":["e26"],"requiredPrevSkillId":"e24","cost":10000,"name":"Headshot","rewards":["13;250"]},
        {"id":"e26","nextSkillIds":["e27","e31","e32"],"requiredPrevSkillId":"e25","cost":25000,"name":"Middle","rewards":["16;500"]},
        {"id":"e27","nextSkillIds":["e28"],"requiredPrevSkillId":"e26","cost":10000,"name":"A Connector","rewards":["14;25"]},
        {"id":"e28","nextSkillIds":["e29"],"requiredPrevSkillId":"e27","cost":10000,"name":"Walkway","rewards":["14;25"]},
        {"id":"e29","nextSkillIds":["e30"],"requiredPrevSkillId":"e28","cost":10000,"name":"Box","rewards":["13;500"]},
        {"id":"e30","nextSkillIds":[],"requiredPrevSkillId":"e29","cost":25000,"name":"Default","rewards":["13;1000","14;25"]},
        {"id":"e31","nextSkillIds":[],"requiredPrevSkillId":"e26","cost":500000,"name":"Window","rewards":["17;5"]},
        {"id":"e32","nextSkillIds":[],"requiredPrevSkillId":"e26","cost":500000,"name":"Mid Doors","rewards":["17;5"]},
        {"id":"e33","nextSkillIds":["e34"],"requiredPrevSkillId":"e24","cost":10000,"name":"Palace","rewards":["15;1.5"]},
        {"id":"e34","nextSkillIds":["e35"],"requiredPrevSkillId":"e33","cost":10000,"name":"Bricks","rewards":["15;1.5"]},
        {"id":"e35","nextSkillIds":["e36"],"requiredPrevSkillId":"e34","cost":10000,"name":"Back Site","rewards":["11;0.01"]},
        {"id":"e36","nextSkillIds":[],"requiredPrevSkillId":"e35","cost":25000,"name":"Dark","rewards":["11;0.01","15;1.5"]},
        {"id":"e37","nextSkillIds":[],"requiredPrevSkillId":"e19","cost":30000,"name":"Snipers Nest","rewards":["13;1000"]},
        {"id":"e38","nextSkillIds":["e39"],"requiredPrevSkillId":"e19","cost":10000,"name":"Cave","rewards":["11;0.01"]},
        {"id":"e39","nextSkillIds":["e40"],"requiredPrevSkillId":"e38","cost":10000,"name":"Alley","rewards":["11;0.02"]},
        {"id":"e40","nextSkillIds":["e41"],"requiredPrevSkillId":"e39","cost":25000,"name":"Ninja","rewards":["11;0.02"]},
        {"id":"e41","nextSkillIds":[],"requiredPrevSkillId":"e40","cost":50000,"name":"B Plat","rewards":["17;2","11;0.05"]}
    ];

    // Cobblestone
    allSkillData["Cobblestone"].skills = [
        {"id":"f1","nextSkillIds":["f2","f3"],"requiredPrevSkillId":null,"cost":10000,"name":"T Spawn","rewards":["11;0.01"]},
        {"id":"f2","nextSkillIds":[],"requiredPrevSkillId":"f1","cost":20000,"name":"Snipers Nest","rewards":["13;1500"]},
        {"id":"f3","nextSkillIds":["f4","f9"],"requiredPrevSkillId":"f1","cost":20000,"name":"Statue","rewards":["15;1"]},
        {"id":"f4","nextSkillIds":["f5"],"requiredPrevSkillId":"f3","cost":20000,"name":"T Ramp","rewards":["11;0.02"]},
        {"id":"f5","nextSkillIds":["f6"],"requiredPrevSkillId":"f4","cost":40000,"name":"Catwalk","rewards":["11;0.04"]},
        {"id":"f6","nextSkillIds":["f7"],"requiredPrevSkillId":"f5","cost":40000,"name":"Barrels","rewards":["11;0.04"]},
        {"id":"f7","nextSkillIds":["f8"],"requiredPrevSkillId":"f6","cost":80000,"name":"Boost","rewards":["11;0.1"]},
        {"id":"f8","nextSkillIds":[],"requiredPrevSkillId":"f7","cost":150000,"name":"A Long","rewards":["11;0.3"]},
        {"id":"f9","nextSkillIds":["f10"],"requiredPrevSkillId":"f3","cost":20000,"name":"Patio","rewards":["14;50"]},
        {"id":"f10","nextSkillIds":["f11"],"requiredPrevSkillId":"f9","cost":20000,"name":"Dragon","rewards":["13;2000"]},
        {"id":"f11","nextSkillIds":["f12","f14"],"requiredPrevSkillId":"f10","cost":50000,"name":"B Halls","rewards":["13;1000","11;0.05","15;1"]},
        {"id":"f12","nextSkillIds":["f13"],"requiredPrevSkillId":"f11","cost":20000,"name":"Spiral Staircase","rewards":["13;2000"]},
        {"id":"f13","nextSkillIds":[],"requiredPrevSkillId":"f12","cost":100000,"name":"Sky","rewards":["14;50","11;0.1"]},
        {"id":"f14","nextSkillIds":["f15"],"requiredPrevSkillId":"f11","cost":20000,"name":"B Long","rewards":["15;1"]},
        {"id":"f15","nextSkillIds":[],"requiredPrevSkillId":"f14","cost":100000,"name":"B Plat","rewards":["11;0.1"]},
        {"id":"f16","nextSkillIds":["f17","f19","f21"],"requiredPrevSkillId":null,"cost":50000,"name":"CT Spawn","rewards":["16;1000"]},
        {"id":"f17","nextSkillIds":["f18"],"requiredPrevSkillId":"f16","cost":20000,"name":"Stables","rewards":["13;2000"]},
        {"id":"f18","nextSkillIds":[],"requiredPrevSkillId":"f17","cost":20000,"name":"Cubby","rewards":["14;50"]},
        {"id":"f19","nextSkillIds":["f20"],"requiredPrevSkillId":"f16","cost":20000,"name":"CT Ramp","rewards":["14;50"]},
        {"id":"f20","nextSkillIds":[],"requiredPrevSkillId":"f19","cost":500000,"name":"Mid","rewards":["17;3"]},
        {"id":"f21","nextSkillIds":["f22"],"requiredPrevSkillId":"f16","cost":20000,"name":"Balcony","rewards":["11;0.025"]},
        {"id":"f22","nextSkillIds":["f23"],"requiredPrevSkillId":"f21","cost":20000,"name":"A Vent","rewards":["15;1"]},
        {"id":"f23","nextSkillIds":["f24"],"requiredPrevSkillId":"f22","cost":20000,"name":"A Doors","rewards":["11;0.025"]},
        {"id":"f24","nextSkillIds":["f25","f28"],"requiredPrevSkillId":"f23","cost":50000,"name":"Connector","rewards":["15;2"]},
        {"id":"f25","nextSkillIds":["f26"],"requiredPrevSkillId":"f24","cost":20000,"name":"Window","rewards":["15;1"]},
        {"id":"f26","nextSkillIds":["f27"],"requiredPrevSkillId":"f25","cost":20000,"name":"B Drop","rewards":["14;50"]},
        {"id":"f27","nextSkillIds":[],"requiredPrevSkillId":"f26","cost":1000000,"name":"Electric","rewards":["19;15","15;1"]},
        {"id":"f28","nextSkillIds":["f29"],"requiredPrevSkillId":"f24","cost":20000,"name":"B Doors","rewards":["11;0.025"]},
        {"id":"f29","nextSkillIds":["f30"],"requiredPrevSkillId":"f28","cost":20000,"name":"Rock","rewards":["13;1000"]},
        {"id":"f30","nextSkillIds":["f31"],"requiredPrevSkillId":"f29","cost":25000,"name":"Chicken","rewards":["16;500"]},
        {"id":"f31","nextSkillIds":[],"requiredPrevSkillId":"f30","cost":3000000,"name":"Ninja","rewards":["20;1","15;1"]}
    ];

    const allSkillsById = {};
    for (const mapName in allSkillData) {
        allSkillData[mapName].skills.forEach(skill => {
            allSkillsById[skill.id] = { ...skill, mapName: mapName };
        });
    }

    // Calculate Depths for sorting (0 = root, 1 = child, etc)
    const skillDepths = {};
    const calculateDepth = (id) => {
        if (skillDepths[id] !== undefined) return skillDepths[id];
        const skill = allSkillsById[id];
        if (!skill) return 0;
        if (!skill.requiredPrevSkillId) {
            skillDepths[id] = 0;
            return 0;
        }
        skillDepths[id] = 1 + calculateDepth(skill.requiredPrevSkillId);
        return skillDepths[id];
    };
    Object.keys(allSkillsById).forEach(calculateDepth);

    const rewardDecoder = {
        '11': { name: 'Click Money', unit: '$', precision: 3 },
        '13': { name: 'Vault Capacity', unit: '$', precision: 0 },
        '14': { name: 'Vault Gen/Min', unit: '$', precision: 1 },
        '15': { name: 'Case Percentage', unit: '%', precision: 2 },
        '16': { name: 'Inventory Size', unit: '', precision: 0 },
        '17': { name: 'Max case count', unit: '', precision: 0 },
        '19': { name: 'Max Case Click Value', unit: '$', precision: 0 },
        '20': { name: 'Case opening multiplier', unit: 'x', precision: 0 }
    };

    // ----------------------------------------------------------------------------------
    //  STEP 3: PRESETS
    // ----------------------------------------------------------------------------------

    // ==================================================================================
    // F27 + F31 + MAX CASE COUNT — exactly 54 skills
    // Goal: hit >=25% case chance (24% from skills + 1% default), then pure max cases
    //
    // BREAKDOWN (54 skills total):
    //
    // COBBLESTONE (13 skills) — 6% case%, $15 max case click, 1x multi
    //   F27 path: f16, f21, f22, f23, f24, f25, f26, f27
    //   F31 path: (f24 shared) f28, f29, f30, f31
    //   f19 included here (f20 bought later as pure max case)
    //
    // ANCIENT T (11 skills) — 6% case%, +5 max cases
    //   B Ramp path: d13, d14, d15, d16, d17     (+3 max cases, 3% case%)
    //   A Main:      d24, d25                     (2% case%, d13 shared)
    //   Upper Mid:   d18, d21                     (1% case%, d13 shared)
    //   Donut:       d19, d23                     (+2 max cases, d18 shared)
    //
    // ANUBIS T (7 skills) — 5% case%, +3 max cases
    //   Plat path: e1, e6, e10, e15, e16, e17, e18
    //
    // ANUBIS CT (6 skills) — 4.5% case%
    //   Palace path: e19, e24, e33, e34, e35, e36
    //
    // INFERNO CT (4 skills) — 3% case%  [c13 shared]
    //   c13, c24, c30, c31   (2% from c24+c30+c31... wait: c24=1%, c30=0.5%, c31=0.5% = 2%)
    //   NOTE: c13 gives 0 case%, c24=1%, c30=0.5%, c31=0.5%
    //   Total: 2% case% from 4 skills. Brings running total to 24.5% ✓
    //
    // ── RUNNING TOTAL AT 41 SKILLS: 24.5% case% (25.5% with default) ✓ ──
    //
    // PURE MAX CASE SKILLS (13 skills) — +17 max cases
    //   f20           (1 skill, f19 shared)         → +3 max cases
    //   e25,e26,e31   (3 skills, e24 shared)         → +5 max cases
    //   e32           (1 skill, e26 shared)           → +5 max cases
    //   e11,e12,e13,e14 (4 skills, e10 shared)       → +2 max cases
    //   e38,e39,e40,e41 (4 skills, e19 shared)       → +2 max cases
    //
    // GRAND TOTAL: 54 skills ✓
    // CASE %: 24.5% from skills → 25.5% with default ✓ (well above 25%, minimal overshoot)
    // MAX CASES: +3(d17) +2(d23) +3(e18) +3(f20) +5(e31) +5(e32) +2(e14) +2(e41) = +25
    // ==================================================================================

    const godBuildF27F31MaxCases = [
        // --- Cobblestone (13 skills) — F27 + F31 mandatory, f19 for f20 later ---
        'f16', 'f21', 'f22', 'f23', 'f24', 'f25', 'f26', 'f27', // F27 path
        'f28', 'f29', 'f30', 'f31',                               // F31 branch
        'f19',                                                     // unlocks f20 (bought below)

        // --- Ancient T side (11 skills) — 6% case% + 5 max cases ---
        'd13', 'd14', 'd15', 'd16', 'd17', // B Ramp: 3% case% + 3 max cases
        'd24', 'd25',                       // A Main: +2% case%
        'd18', 'd21',                       // Upper Mid: +1% case%
        'd19', 'd23',                       // Donut: +2 max cases (d18 shared)

        // --- Anubis T side (7 skills) — 5% case% + 3 max cases ---
        'e1', 'e6', 'e10', 'e15', 'e16', 'e17', 'e18',

        // --- Anubis CT side (6 skills) — 4.5% case% ---
        'e19', 'e24', 'e33', 'e34', 'e35', 'e36',

        // --- Inferno CT (4 skills) — 2% case% — brings total to 24.5% ✓ ---
        'c13', 'c24', 'c30', 'c31',

        // ── 41 skills used, 24.5% case%, now pure max cases ──

        // --- Pure Max Case skills (13 skills) ---
        'f20',                       // +3 max cases (f19 shared above)
        'e25', 'e26', 'e31', 'e32',  // +10 max cases (e19,e24 shared above)
        'e11', 'e12', 'e13', 'e14',  // +2 max cases (e10 shared above)
        'e38', 'e39', 'e40', 'e41',  // +2 max cases (e19 shared above)
    ];

    const godBuildFromImages = [
        'f16', 'f21', 'f22', 'f23', 'f24', 'f25', 'f26', 'f27',
        'f28', 'f29', 'f30', 'f31',
        'f19', 'f20',
        'e1', 'e6', 'e10', 'e15', 'e16', 'e17', 'e18', 'e11',
        'e19', 'e24', 'e33', 'e34', 'e35', 'e36',
        'd13', 'd14', 'd15', 'd16', 'd17',
        'd24', 'd25',
        'd18', 'd21',
        'd1', 'd2', 'd3', 'd5',
        'd8', 'd9', 'd11',
        'c13', 'c14', 'c15', 'c16', 'c17',
        'c24',
        'c30', 'c31', 'c34', 'c35'
    ];

    const godBuildOptimized = [
        'b1', 'b11', 'b15', 'b16', 'b17', 'b12', 'b13', 'b14', 'b18', 'b25', 'b26', 'b27', 'b28',
        'c13', 'c14', 'c15', 'c16', 'c17', 'c30', 'c31', 'c34', 'c35', 'c24',
        'd13', 'd24', 'd25', 'd14', 'd15', 'd16', 'd17', 'd18', 'd21', 'd1', 'd2', 'd3', 'd5', 'd8', 'd9', 'd11', 'd19',
        'e1', 'e6', 'e10', 'e15', 'e16', 'e17', 'e18', 'e11', 'e19', 'e24', 'e33', 'e34', 'e35', 'e36'
    ];

    const godBuildF27 = [
        'f16', 'f21', 'f22', 'f23', 'f24', 'f25', 'f26', 'f27', 'f19',
        'e19', 'e24', 'e33', 'e34', 'e35', 'e36',
        'e1', 'e6', 'e10', 'e11', 'e15', 'e16', 'e17', 'e18',
        'd13', 'd14', 'd15', 'd16', 'd17', 'd24', 'd25', 'd18', 'd21',
        'd1', 'd2', 'd3', 'd5', 'd8', 'd9', 'd11',
        'c13', 'c14', 'c15', 'c16', 'c17', 'c24',
        'c30', 'c31', 'c34', 'c35',
        'b1', 'b11', 'b12', 'b13', 'b14'
    ];

    const godBuildClickMoney = [
        'f1', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12', 'f13', 'f14', 'f15', 'f16', 'f21', 'f22', 'f23', 'f24', 'f28', 'f19',
        'e19', 'e38', 'e39', 'e40', 'e41', 'e1', 'e2', 'e3', 'e4', 'e5', 'e24', 'e33', 'e34', 'e35', 'e36',
        'd13', 'd14', 'd15', 'd16', 'd17', 'd1', 'd2', 'd3', 'd4',
        'c13', 'c14', 'c15', 'c20', 'c21', 'c22', 'c23', 'c18', 'c19'
    ];

    const skillPresets = {
        sellMap: {
            name: "Sell All Skills",
            description: "Resets your entire skill map. Applying any skillmap will also run this.",
            isSellMap: true,
            skillIds: Object.keys(allSkillsById)
        },
        f27f31MaxCasesBuild: {
            name: "25% Case Click, Max Case Opens",
            description: "F27 + F31. Hits exactly 25% case chance then dumps all remaining points into max case count. +25 max cases total.",
            skillIds: godBuildF27F31MaxCases
        },
        imageBuild: {
            name: "ZSBs 5k case map",
            description: "ZSBs case clicking map from Discord, $25 cases, 2x multi.",
            skillIds: godBuildFromImages
        },
        optimizedBuild: {
            name: "Global Elite Optimized",
            description: "Gemini optimized 33.3%+ cases, rest to vault gen/min.",
            skillIds: godBuildOptimized
        },
        f27Build: {
            name: "5K case skillmap",
            description: "$25 cases. Gemini optimized 33.3%+ cases, rest to vault gen/min.",
            skillIds: godBuildF27
        },
        maxClickBuild: {
            name: "Max Click Money ($1.00+/click)",
            description: "Prioritizes Click Money above all else. Includes A Long ($0.30), B Plat ($0.10), etc.",
            skillIds: godBuildClickMoney
        }
    };

    // ----------------------------------------------------------------------------------
    //  UI & UTILS
    // ----------------------------------------------------------------------------------
    const config = { apiDelay: 250, uiTop: '20px', uiRight: '20px' };

    function formatNumber(num) {
        if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
        if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
        return num.toString();
    }

    function calculatePresetStats(preset) {
        let totalCost = 0;
        const totalBonuses = {};
        const uniqueIds = [...new Set(preset.skillIds)];
        const skillPoints = uniqueIds.length;

        uniqueIds.forEach(id => {
            const skill = allSkillsById[id];
            if (!skill) {
                console.warn(`Skill ID ${id} not found in data!`);
                return;
            }
            totalCost += skill.cost;
            skill.rewards.forEach(rewardString => {
                const [typeId, value] = rewardString.split(';');
                if (!totalBonuses[typeId]) totalBonuses[typeId] = 0;
                totalBonuses[typeId] += parseFloat(value);
            });
        });
        if (totalBonuses['15']) totalBonuses['15'] += 1.0;
        console.log(`Stats for ${preset.name}: Cost ${totalCost}, Points ${skillPoints}`, totalBonuses);
        return { totalCost, totalBonuses, skillPoints };
    }

    // --- UI State Management ---
    const uiState = {
        minimized: localStorage.getItem('asp_minimized') === 'true',
        top: localStorage.getItem('asp_top') || config.uiTop,
        left: localStorage.getItem('asp_left') || 'auto',
        right: localStorage.getItem('asp_right') || config.uiRight,
        width: localStorage.getItem('asp_width') || '320px',
        height: localStorage.getItem('asp_height') || 'auto'
    };

    function saveUiState() {
        const ui = document.getElementById('autoskill-pro-ui');
        if (!ui) return;
        localStorage.setItem('asp_minimized', uiState.minimized);
        localStorage.setItem('asp_top', ui.style.top);
        localStorage.setItem('asp_left', ui.style.left);
        localStorage.setItem('asp_width', ui.style.width);
        localStorage.setItem('asp_height', ui.style.height);
    }

    function setupUI() {
        const uiContainer = document.createElement('div');
        uiContainer.id = 'autoskill-pro-ui';

        uiContainer.style.top = uiState.top;
        if (uiState.left !== 'auto') {
            uiContainer.style.left = uiState.left;
            uiContainer.style.right = 'auto';
        } else {
            uiContainer.style.right = uiState.right;
        }
        uiContainer.style.width = uiState.width;
        if (uiState.height !== 'auto') uiContainer.style.height = uiState.height;

        const minimizeIcon = uiState.minimized ? '+' : '_';
        const contentDisplay = uiState.minimized ? 'none' : 'flex';

        uiContainer.innerHTML = `
            <div class="header">
                <h2>Auto Skill Pro</h2>
                <div class="header-controls">
                     <div id="status-light" title="Idle"></div>
                     <button id="minimize-btn">${minimizeIcon}</button>
                </div>
            </div>
            <div id="ui-content" style="display: ${contentDisplay};">
                <div id="status-text">Ready</div>
                <div id="presets-container"></div>
            </div>
        `;
        document.body.appendChild(uiContainer);

        const header = uiContainer.querySelector('.header');
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };

        header.addEventListener('mousedown', (e) => {
            if (e.target.id === 'minimize-btn') return;
            isDragging = true;
            const rect = uiContainer.getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;
            uiContainer.style.right = 'auto';
            uiContainer.style.bottom = 'auto';
            uiContainer.style.width = rect.width + 'px';
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                uiContainer.style.left = (e.clientX - dragOffset.x) + 'px';
                uiContainer.style.top = (e.clientY - dragOffset.y) + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                saveUiState();
            }
        });

        document.getElementById('minimize-btn').addEventListener('click', () => {
            uiState.minimized = !uiState.minimized;
            const content = document.getElementById('ui-content');
            const btn = document.getElementById('minimize-btn');

            if (uiState.minimized) {
                content.style.display = 'none';
                btn.textContent = '+';
                uiContainer.style.height = 'auto';
                uiContainer.style.resize = 'none';
            } else {
                content.style.display = 'flex';
                btn.textContent = '_';
                uiContainer.style.resize = 'both';
                if(uiState.height !== 'auto') uiContainer.style.height = uiState.height;
            }
            saveUiState();
        });

        new ResizeObserver(() => {
            if (!uiState.minimized) {
                saveUiState();
            }
        }).observe(uiContainer);

        const presetsContainer = document.getElementById('presets-container');
        for (const presetId in skillPresets) {
            const preset = skillPresets[presetId];
            const stats = preset.isSellMap ? { totalCost: 0, totalBonuses: {}, skillPoints: 0 } : calculatePresetStats(preset);
            let bonusHTML = '';
            const sortedBonusKeys = Object.keys(stats.totalBonuses).sort((a, b) => a - b);
            for (const typeId of sortedBonusKeys) {
                const decoder = rewardDecoder[typeId];
                if (decoder) {
                    const totalValue = stats.totalBonuses[typeId];
                    bonusHTML += `<li><strong>${decoder.unit === 'x' ? '' : '+'}${totalValue.toFixed(decoder.precision)}${decoder.unit}</strong> ${decoder.name}</li>`;
                }
            }
            if (stats.skillPoints > 0) bonusHTML += `<li><strong>${stats.skillPoints} / 54</strong> Skill Points</li>`;

            const presetElement = document.createElement('div');
            presetElement.className = 'preset-card';

            const detailsDisplay = 'none';
            const toggleIcon = '▼';

            presetElement.innerHTML = `
                <div class="preset-header">
                    <h3>${preset.name}</h3>
                    <span class="toggle-icon">${toggleIcon}</span>
                </div>
                <div class="preset-details" style="display: ${detailsDisplay};">
                    <p class="description">${preset.description}</p>
                    ${!preset.isSellMap ? `<div class="stats">
                        <div class="cost"><strong>Cost:</strong><span>$${formatNumber(stats.totalCost)}</span></div>
                        <ul class="bonuses">${bonusHTML}</ul>
                    </div>` : ''}
                </div>
                <button class="action-button" data-preset-id="${presetId}">${preset.isSellMap ? 'Sell All Skills' : 'Apply Preset'}</button>
            `;

            const cardHeader = presetElement.querySelector('.preset-header');
            const details = presetElement.querySelector('.preset-details');
            const icon = presetElement.querySelector('.toggle-icon');

            cardHeader.addEventListener('click', () => {
                const isHidden = details.style.display === 'none';
                details.style.display = isHidden ? 'block' : 'none';
                icon.textContent = isHidden ? '▲' : '▼';
            });

            presetsContainer.appendChild(presetElement);
        }

        document.querySelectorAll('.action-button').forEach(button => {
            button.addEventListener('click', (e) => {
                runPreset(e.target.getAttribute('data-preset-id'));
            });
        });
    }

    async function runPreset(presetId) {
        const preset = skillPresets[presetId];
        const allButtons = document.querySelectorAll('.action-button');
        const statusText = document.getElementById('status-text');
        const statusLight = document.getElementById('status-light');

        console.log("Applying Preset:", preset.skillIds);

        allButtons.forEach(b => b.disabled = true);
        statusLight.style.backgroundColor = '#fca903';

        let skillsToProcess;
        if (preset.isSellMap) {
            skillsToProcess = [...preset.skillIds].sort((a, b) => skillDepths[b] - skillDepths[a]);
        } else {
            skillsToProcess = [...new Set(preset.skillIds)].sort((a, b) => skillDepths[a] - skillDepths[b]);
        }

        if (!preset.isSellMap) {
            statusText.textContent = `Resetting... (0%)`;
            const skillsToDelete = [...skillPresets.sellMap.skillIds].sort((a, b) => skillDepths[b] - skillDepths[a]);
            await processSkills(skillsToDelete, 'DELETE', (progress) => statusText.textContent = `Resetting... (${progress.toFixed(0)}%)`);
        }

        statusText.textContent = `Applying... (0%)`;
        await processSkills(skillsToProcess, preset.isSellMap ? 'DELETE' : 'POST', (progress) => statusText.textContent = `${preset.isSellMap ? 'Selling' : 'Applying'}... (${progress.toFixed(0)}%)`);

        allButtons.forEach(b => b.disabled = false);
        statusLight.style.backgroundColor = '#4CAF50';
        statusText.textContent = `Done!`;
        setTimeout(() => { statusLight.style.backgroundColor = '#bbb'; statusText.textContent = 'Ready'; }, 5000);
    }

    async function processSkills(skillIds, method, onProgress) {
        let currentDelay = config.apiDelay;
        const totalSkills = skillIds.length;
        for (let i = 0; i < totalSkills; i++) {
            const skillId = skillIds[i];
            const skill = allSkillsById[skillId];
            if(!skill) continue;
            let locked = false;
            do {
                try {
                    const res = await fetch('https://case-clicker.com/api/skill', {
                        method: method,
                        body: JSON.stringify({ mapName: skill.mapName, skillId: skill.id }),
                        headers: { 'Content-Type': 'application/json' }
                    });
                    if (!res.ok) {
                        if (method === 'DELETE' && res.status === 400) {
                            locked = false;
                        } else {
                            throw new Error(`Status ${res.status}`);
                        }
                    } else {
                        const data = await res.json();
                        if (data.error && data.error.includes('locked')) {
                            locked = true;
                            await new Promise(r => setTimeout(r, currentDelay));
                            currentDelay = Math.min(currentDelay * 2, 8000);
                        } else {
                            locked = false;
                            currentDelay = config.apiDelay;
                        }
                    }
                } catch (err) {
                    console.error('API fail', err);
                    locked = true;
                    await new Promise(r => setTimeout(r, currentDelay));
                }
            } while (locked);
            if (onProgress) onProgress(((i + 1) / totalSkills) * 100);
        }
    }

    function addStyles() {
        GM_addStyle(`
            #autoskill-pro-ui {
                position: fixed;
                z-index: 10000;
                background: #2c2f33;
                border-radius: 10px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                color: #fff;
                font-family: 'Segoe UI', sans-serif;
                border: 1px solid #444;
                display: flex;
                flex-direction: column;
                min-width: 280px;
                max-height: 80vh;
                min-height: 120px;
                resize: both;
                overflow: hidden;
            }
            #autoskill-pro-ui .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: #23272a;
                padding: 10px 15px;
                cursor: move;
                user-select: none;
                flex-shrink: 0;
            }
            #autoskill-pro-ui h2 { margin: 0; font-size: 16px; font-weight: 600; }
            .header-controls { display: flex; align-items: center; gap: 10px; }
            #status-light { width: 12px; height: 12px; background-color: #bbb; border-radius: 50%; transition: background-color .3s; }
            #minimize-btn {
                background: none; border: none; color: #aaa; font-weight: bold; cursor: pointer; font-size: 18px; line-height: 1; padding: 0 5px;
            }
            #minimize-btn:hover { color: #fff; }
            #ui-content {
                flex-grow: 1;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                scrollbar-width: thin;
                scrollbar-color: #202225 #2c2f33;
            }
            #ui-content::-webkit-scrollbar { width: 8px; }
            #ui-content::-webkit-scrollbar-track { background: #2c2f33; }
            #ui-content::-webkit-scrollbar-thumb { background-color: #202225; border-radius: 4px; border: 2px solid #2c2f33; }
            #status-text { padding: 8px 15px; background: rgba(0,0,0,.1); font-size: 12px; text-align: center; color: #ccc; flex-shrink: 0; }
            #presets-container { padding: 10px; flex-grow: 1; }

            .preset-card { background: #36393f; border-radius: 5px; padding: 10px; margin-bottom: 8px; border: 1px solid #40444b; }

            .preset-header {
                display: flex; justify-content: space-between; align-items: center; cursor: pointer; padding-bottom: 5px;
            }
            .preset-header:hover h3 { color: #10b981; }

            .preset-card h3 { margin: 0; font-size: 14px; color: #0ca678; transition: color 0.2s; }
            .toggle-icon { font-size: 12px; color: #aaa; }

            .preset-details { margin-top: 5px; margin-bottom: 10px; border-top: 1px solid #444; padding-top: 8px; }
            .preset-card .description { font-size: 12px; margin: 0 0 8px 0; color: #b9bbbe; }
            .preset-card .stats { background: rgba(0,0,0,.15); border-radius: 4px; padding: 8px; }
            .preset-card .cost { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; }
            .preset-card .cost span { font-weight: 700; color: #fff; }
            .preset-card .bonuses { list-style: none; padding: 0; margin: 0; font-size: 11px; }
            .preset-card .bonuses li { color: #dcddde; margin-bottom: 3px; }

            .action-button { width: 100%; padding: 8px 10px; border: none; border-radius: 5px; background-color: #0ca678; color: #fff; font-weight: 700; cursor: pointer; transition: background-color .2s; font-size: 13px; margin-top: 5px; }
            .action-button:hover:not(:disabled) { background-color: #099268; }
            .action-button:disabled { background-color: #555; cursor: not-allowed; }

        `);
    }

    window.addEventListener('load', () => { addStyles(); setupUI(); });
})();
