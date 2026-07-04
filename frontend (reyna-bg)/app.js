const tournaments = [
    {
        title: "Weekend Ignition Cup",
        status: "Open",
        format: "5v5 — Single elimination — Bo1",
        date: "Starts Jul 6",
        teams: "32/64 Teams"
    },

    {
        title: "Premier Feeder Series",
        status: "Live",
        format: "5v5 — Group stage — Bo3",
        date: "Round 3 of 5",
        teams: "16 Teams"
    },

    {
        title: "Skirmish Ascension",
        status: "Open",
        format: "2v2 — Swiss — Bo1",
        date: "Starts Jul 12",
        teams: "21/48 Duos"
    },

    {
        title: "Off-Angle Invitational",
        status: "Closed",
        format: "5v5 — Single elimination — Bo3",
        date: "Ended Jun 21",
        teams: "Champion: Nullpoint"
    },

    {
        title: "Rookie Rush",
        status: "Open",
        format: "5v5 — Under Diamond — Bo1",
        date: "Starts Jul 9",
        teams: "9/32 Teams"
    },

    {
        title: "Late Night Customs Cup",
        status: "Open",
        format: "5v5 — Round Robin — Bo1",
        date: "Starts Jul 8",
        teams: "12/20 Teams"
    }
];

const tournamentGrid = document.getElementById("tournamentGrid");
let card = "";

for (let tournament of tournaments) {
    card += `
        <div class="card">
            <div class="card-top">
                <span class="badge ${tournament.status.toLowerCase()}">
                    ${tournament.status}
                </span>
            </div>

            <h3>${tournament.title}</h3>

            <div class="fmt">
                ${tournament.format}
            </div>

            <div class="card-meta">
                <span class="mono">${tournament.date}</span>
                <span class="mono">${tournament.teams}</span>
            </div>
        </div>
    `;

}
    
tournamentGrid.innerHTML = card;


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

