const btn = document.querySelector(".menu-btn");
const menu = document.querySelector(".mobile-menu");

btn.addEventListener("click", () => {
    menu.classList.toggle("active");
});

const reveals=document.querySelectorAll(".reveal");

const observer=new IntersectionObserver(entries=>{

    entries.forEach(entry=>{

        if(entry.isIntersecting){
            entry.target.classList.add("active");
        }

    });

},{
    threshold:.15
});

reveals.forEach(item=>observer.observe(item));
