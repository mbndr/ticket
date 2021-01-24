(function(){

    const STATE_NEW = "n";
    const STATE_IN_PROGRESS = "p";
    const STATE_DONE = "d";
    const STATE_CANCELED = "c";

    const STATE2STRING = {
        [STATE_NEW]: "new",
        [STATE_IN_PROGRESS]: "in progress",
        [STATE_DONE]: "done",
        [STATE_CANCELED]: "canceled"
    };

    let currentSorting = {
        "name": "", // e.g. subject
        "asc": false,
    };

    function createFlashManager() {
        const flash = document.getElementById("flash");
        flash.hidden = true;

        return {
            message: function(m) {
                flash.innerText = m;
                flash.hidden = false;

                setTimeout(function() {
                    flash.hidden = true;
                }, 1000);
            }
        }
    }

    function createTicketManager() {
        const STORAGE_KEY_TICKETS = "t:tickets";
        const STORAGE_KEY_TOGGLE = "t:toggle";

        let tickets = {}; // uid => valueObj

        function loadTickets() {
            tickets = JSON.parse(localStorage.getItem(STORAGE_KEY_TICKETS)) || {};
        }

        // save to localStorage
        function saveTickets() {
            localStorage.setItem(STORAGE_KEY_TICKETS, JSON.stringify(tickets))
        }

        // ticket is always an object generated with newTicket()
        return {
            add: function(ticket) {
                loadTickets();
                tickets[ticket.uid] = ticket;
                saveTickets();
            },
            update: function(ticket) {
                loadTickets();
                ticket.modified = Date.now();
                tickets[ticket.uid] = ticket;
                saveTickets();
            },
            remove: function(uid) {
                loadTickets();
                delete tickets[uid];
                saveTickets();
            },
            all: function() {
                loadTickets();
                return tickets;
            },
            newTicket: function(values) {
                loadTickets();
                
                let uid;
                do {
                    uid = generateUID()
                } while(tickets[uid]);

                let t = {};
                t.uid = uid;
                t.subject = values.subject;
                t.text = values.text;
                t.created = Date.now();
                t.modified = Date.now();
                t.state = STATE_NEW; 
                t.priority = false;

                return t;
            },
            setAll: function(newTickets) {
                tickets = newTickets;
                saveTickets();
            },
            getToggle: function() {
                return JSON.parse(localStorage.getItem(STORAGE_KEY_TOGGLE));
            },
            setToggle: function(toggle) {
                localStorage.setItem(STORAGE_KEY_TOGGLE, JSON.stringify(toggle));
            }
        }
    }

    // create a renderer object
    function createTicketRenderer(ticketManager, flashManager) {
        const DETAIL_SUFFIX = "_detail";
        const EXPANDED_CLASS = "expanded";

        const table = document.getElementById("tickets");
        const ticketTemplate = document.getElementById("ticketTemplate");

        // sorty by a specific key and returns an uid list
        function sortBy(key, asc = true) {
            const tickets = ticketManager.all();
            let sortable = [];
            for (let uid in tickets) {
                sortable.push([uid, tickets[uid][key]]);
            }
            sortable.sort(function(a, b) {
                if (a[1] < b[1]) return -1;
                if (a[1] > b[1]) return 1;
                return 0;
            });

            let sortedArray = sortable.map(function(e) {
                return e[0];
            });

            if (!asc) sortedArray.reverse();
            return sortedArray;
        }

        function toggleTicket(uid) {
            const ticketRow = document.getElementById(uid);
            const detailRow = document.getElementById(uid + DETAIL_SUFFIX);

            if (!ticketRow || !detailRow) return;

            if (detailRow.hidden) {
                detailRow.hidden = false;
                ticketRow.classList.add(EXPANDED_CLASS);
                location.hash = uid;
            }
            else {
                detailRow.hidden = true;
                ticketRow.classList.remove(EXPANDED_CLASS);
                location.hash = "";
            }
        }

        function fillTicketRow(ticket, ticketRow, i) {
            ticketRow.id = ticket.uid;
            ticketRow.classList.add(
                (i % 2 == 0) ? "e" : "o"
            );
            
            let modified = ticketRow.querySelector(".modified");
            let modifiedDate = date2str(new Date(ticket.modified));
            let createdDate = date2str(new Date(ticket.created));
            
            ticketRow.querySelector(".uid").innerText = ticket.uid;
            ticketRow.querySelector(".priority").hidden = !ticket.priority;

            ticketRow.querySelector(".subject").innerText = ticket.subject;

            modified.innerText = modifiedDate;
            modified.title = "Created: " + createdDate + "\nModified: " + modifiedDate;
            
            ticketRow.querySelector(".state").innerText = STATE2STRING[ticket.state];
            ticketRow.querySelector(".state").classList.add(ticket.state);

            ticketRow.addEventListener("click", function() {
                toggleTicket(ticket.uid);
                registerTextareas();
            });
        }

        function fillDetailRow(ticket, detailRow) {
            detailRow.id = ticket.uid + DETAIL_SUFFIX;
            detailRow.hidden = true;

            let saveButton = detailRow.querySelector(".save");
            let deleteButton = detailRow.querySelector(".delete");

            let subjectInput = detailRow.querySelector(".subject");
            subjectInput.value = ticket.subject;
            subjectInput.addEventListener("keyup", function(e) {
                if (e.keyCode === 13) {
                    saveButton.click();
                }
            });

            let textInput = detailRow.querySelector(".text");
            textInput.value = ticket.text;

            let priorityInput = detailRow.querySelector(".priority");
            priorityInput.checked = (ticket.priority == true);
            
            let stateRadios = detailRow.querySelectorAll(".state");
            for (let i = 0; i < stateRadios.length; i++) {
                stateRadios[i].name = ticket.uid + "_state";
                if (stateRadios[i].value == ticket.state) {
                    stateRadios[i].checked = true;
                }
            }
            
            saveButton.addEventListener("click", function() {
                ticket.subject = subjectInput.value;
                ticket.text = textInput.value;
                ticket.priority = priorityInput.checked;

                if (ticket.subject.length === 0) {
                    alert("No subject given");
                    return;
                }
                
                for (let i = 0; i < stateRadios.length; i++) {
                    if (stateRadios[i].checked) {
                        ticket.state = stateRadios[i].value;
                        break;
                    }
                }
                ticketManager.update(ticket);
                render();
                flashManager.message("Ticket updated");
            });

            deleteButton.addEventListener("click", function() {
                if (confirm("Are you sure?")) {
                    ticketManager.remove(ticket.uid);
                    render();
                    flashManager.message("Ticket removed");
                }
            });
            
        }

        function registerTextareas() {
            const textareas = document.querySelectorAll("textarea.text");

            function autoResize(ta) {
                ta.style.height = ta.scrollHeight + "px";
            }

            for (let i = 0; i < textareas.length; i++) {
                textareas[i].addEventListener("input", function() {
                    autoResize(textareas[i]);
                });
                autoResize(textareas[i]);
            }
        }

        function render() {
            const tickets = ticketManager.all();

            let sortedUids = null;
            if (currentSorting.name !== "") {
                sortedUids = sortBy(currentSorting.name, currentSorting.asc);
            }
            const uids = sortedUids || Object.keys(tickets);

            let newBody = document.createElement("tbody");
            
            for (let i = 0; i < uids.length; i++) {
                const ticket = tickets[uids[i]];
                let html = ticketTemplate.content.cloneNode(true);
                fillTicketRow(ticket, html.querySelector(".ticket-row"), i);
                fillDetailRow(ticket, html.querySelector(".detail-row"));
                newBody.appendChild(html);
            }

            table.replaceChild(newBody, table.querySelector("tbody"));
            
            registerTextareas();
        }

        return {
            render: function() {
                render();
            }
        }
    }

    function registerTableSort(ticketManager, ticketRenderer) {
        const sortIndicators = {
            "subject": {
                "elm": document.getElementById("sort-subject-indicator"),
                "asc": true
            },
            "modified": {
                "elm": document.getElementById("sort-modified-indicator"),
                "asc": true
            },
            "state": {
                "elm": document.getElementById("sort-state-indicator"),
                "asc": true
            }
        };

        // set others hidden, set class at activeSorting
        function updateIndicatorsAndGetAsc(activeSorting) {
            let isAsc = true;
            let keys = Object.keys(sortIndicators);
            
            for (let i = 0; i < keys.length; i++) {
                let sortObj = sortIndicators[keys[i]]

                if (keys[i] === activeSorting) {
                    isAsc = sortObj.asc;
                    sortObj.elm.hidden = false;
                    sortObj.elm.className = isAsc ? "asc" : "desc";
                    sortIndicators[keys[i]].asc = !sortObj.asc;
                }
                else {
                    sortObj.elm.hidden = true;
                }
            }

            return isAsc;
        }

        // set indicators and global sorting setting
        function setCurrentSorting(name) {
            const isAsc = updateIndicatorsAndGetAsc(name);
            currentSorting.name = name;
            currentSorting.asc = isAsc;
        }

        // table sorting TODO: symbol
        document.getElementById("sort-subject").addEventListener("click", function() {
            setCurrentSorting("subject");
            ticketRenderer.render();
        });
        document.getElementById("sort-modified").addEventListener("click", function() {
            setCurrentSorting("modified");
            ticketRenderer.render();
        });
        document.getElementById("sort-state").addEventListener("click", function() {
            setCurrentSorting("state");
            ticketRenderer.render();
        });
        document.getElementById("sort-reset").addEventListener("click", function() {
            setCurrentSorting("");
            ticketRenderer.render();
        });
    }

    // registers listeners for the "new ticket" form and import / export / clear
    function registerForms(ticketManager, ticketRenderer, flashManager) {
        const new_subject = document.getElementById("new-subject");
        const new_text = document.getElementById("new-text");
        const bottom_container = document.getElementById("bottom-container");

        // is bottom form visible or not
        if (ticketManager.getToggle()) bottom_container.hidden = true;
        document.querySelector("#bottom #toggler").addEventListener("click", function() {
            bottom_container.hidden = !bottom_container.hidden;
            ticketManager.setToggle(bottom_container.hidden);
        });

        document.getElementById("new-form").addEventListener("submit", function(e) {
            e.preventDefault();
            
            if (validateNew()) {
                const ticket = ticketManager.newTicket({
                    "subject": new_subject.value,
                    "text": new_text.value
                });

                ticketManager.add(ticket);
                clearForm();
                ticketRenderer.render();
                flashManager.message("Ticket added");
            }

            function validateNew() {
                if (new_subject.value === "") {
                    flashManager.message("No subject given");
                    return false;
                }
                return true;
            }
    
            function clearForm() {
                new_subject.value = "";
                new_text.value = "";
            }
        });

        document.querySelector("#import").addEventListener("click", function() {
            importJson = prompt("Insert an exported JSON string.\n\nATTENTION: Current data will be lost!");
            ticketManager.setAll(JSON.parse(importJson).tickets);
            ticketRenderer.render();
            flashManager.message("Tickets imported");
        });

        document.querySelector("#export").addEventListener("click", function() {
            exportObj = {
                "tickets": ticketManager.all()
            };
            prompt("Save this JSON string for saving your data.", JSON.stringify(exportObj));
            flashManager.message("Tickets exported");
        });

        document.querySelector("#clear").addEventListener("click", function() {
            if (confirm("Really delete all your data?")) {
                ticketManager.setAll({});
                ticketRenderer.render();
            }
            flashManager.message("Tickets cleared");
        });
    }

    // thanks Stackoverflow!
    function generateUID() {
        var firstPart = (Math.random() * 46656) | 0;
        var secondPart = (Math.random() * 46656) | 0;
        firstPart = ("000" + firstPart.toString(36)).slice(-3);
        secondPart = ("000" + secondPart.toString(36)).slice(-3);
        return firstPart + secondPart;
    }

    function date2str(d) {
        return d.toLocaleDateString() + " " + d.toLocaleTimeString();
    }

    // Starting point
    window.onload = function() {
        const flashManager = createFlashManager();
        const ticketManager = createTicketManager();
        const ticketRenderer = createTicketRenderer(ticketManager, flashManager);
        registerForms(ticketManager, ticketRenderer, flashManager);
        registerTableSort(ticketManager, ticketRenderer);
        ticketRenderer.render();
    }
}());