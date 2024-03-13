
function find_pid(pid, keyword, type){
    console.log('find_pid');
    var loc_plc = document.querySelectorAll('[data-loc_plc-doc-id="'+pid+'"]');
    var plc_href = document.querySelectorAll('a[href*="/'+pid+'"]');
    if(loc_plc.length > 0 || plc_href.length > 0){
        try{
            document.querySelectorAll('[data-loc_plc-doc-id="'+pid+'"] .place_bluelink span')[0].style.border = '2px solid red';
            document.querySelectorAll('[data-loc_plc-doc-id="'+pid+'"] .place_bluelink span')[0].scrollIntoView({ block: "center" });
        }catch(e){

        }
        try{
            document.querySelectorAll('a[href*="/'+pid+'"] .place_bluelink span')[0].style.border = '2px solid red';
            document.querySelectorAll('a[href*="/'+pid+'"] .place_bluelink span')[0].scrollIntoView({ block: "center" });
       }catch(e){

        }
        try {
            document.querySelector('#_title a').style.border = '2px solid red'
        }catch(e){

        }
        if(type == 'save'){
            window.Android.NPSRed();
        }else {
            console.log("traffic");
            window.Android.NPTRed();
        }
    }else{
        var btn_more = Array.from(document.querySelectorAll('a')).find(el => el.textContent === '펼쳐서 더보기');
        if(btn_more) {
            btn_more.style.border = '2px solid red';
            btn_more.scrollIntoView({ block: "center" })
            if(type == 'save'){
                window.Android.NPSMore('펼쳐서 더보기');
                setTimeout(() => {
                    find_pid(pid, keyword, type)
                }, 1000);
            }else {
                window.Android.NPTMore('펼쳐서 더보기');
                setTimeout(() => {
                    find_pid(pid, keyword, type)
                }, 1000);
            }
        }else{
            btn_more = Array.from(document.querySelectorAll('div a')).find(el => el.textContent === keyword+'더보기');
            btn_more.style.border = '2px solid red';
            btn_more.scrollIntoView({ block: "center" })
            if(type == 'save') {
                window.Android.NPSMore(keyword + ' 더보기');
            }else{
                window.Android.NPTMore(keyword + ' 더보기');
            }
            if(btn_more) {
                console.log('clearInterval');
            }else{
                setTimeout(() => {
                    find_pid(pid, keyword, type)
                },1000);
            }
        }
    }
}

function find_more(pid){
    let loc_plc = document.querySelectorAll('[data-loc_plc-doc-id="'+pid+'"]');
    let plc_href = document.querySelectorAll('a[href*="/'+pid+'"]');
    if(loc_plc.length > 0 || plc_href.length > 0){
        try{
            document.querySelectorAll('[data-loc_plc-doc-id="'+pid+'"] .place_bluelink span')[0].style.border = '2px solid red';
            document.querySelectorAll('[data-loc_plc-doc-id="'+pid+'"] .place_bluelink span')[0].scrollIntoView({ block: "center" });

        }catch(e){

        }
        try{
            document.querySelectorAll('a[href*="/'+pid+'"] .place_bluelink span')[0].style.border = '2px solid red';
            document.querySelectorAll('a[href*="/'+pid+'"] .place_bluelink span')[0].scrollIntoView({ block: "center" });

        }catch(e){

        }
        return true;
    }else {
        setTimeout(() => {
            find_more(pid)
        }, 1000);
    }
}
