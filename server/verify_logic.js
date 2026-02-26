// Direct logic test to bypass HTTP/Auth issues
const fallbackAnalyzeEvent = (eventName, eventDescription) => {
    const combinedText = `${eventName} ${eventDescription}`.toLowerCase();
    const detectedComponents = [];
    const followUps = [];
    let nextQuestion = null;

    const keywords = {
        "Resource Person / Chief Guest": ["guest", "speaker", "expert", "resource person", "chief guest", "lecturer", "trainer", "special guest", "keynote", "mentor", "judge"],
        "Event Venue": ["auditorium", "seminar hall", "outdoor", "ground", "hall", "room", "venue", "stadium", "conference room", "classroom", "lab", "theatre"],
        "Sound System": ["audio", "speaker", "mic", "microphone", "sound", "pa system", "amplifier", "handheld mic", "collar mic", "podium mic"],
        "Stage Setup": ["stage", "podium", "backdrop", "dais", "decoration", "lighting", "screen setup", "banner stand", "table cloths", "frills"],
        "Printing": ["banner", "certificate", "poster", "brochure", "pamphlet", "invitation", "printing", "flex banner", "flyer", "notepads", "pen", "documents"],
        "Food": ["lunch", "dinner", "meal", "buffet", "catering", "food", "lunch packets", "working lunch", "non-veg", "veg"],
        "Refreshments": ["snacks", "tea", "coffee", "high tea", "breakfast", "refreshments", "biscuits", "water bottles", "juice", "cool drinks"],
        "Decorations": ["flower", "bouquet", "carpet", "lighting", "ribbon", "decor", "shamiana", "scenery", "stage decoration", "balloons", "welcome arch"],
        "Technical Equipment": ["projector", "laptop", "wifi", "internet", "computer", "system", "screen", "pointer", "extension box", "ups", "generator", "hdmi"],
        "Transportation": ["bus", "car", "taxi", "travel", "transport", "pickup", "drop", "van", "commute", "fuel", "driver allowance", "conveyance"],
        "Accommodation": ["stay", "hotel", "room", "lodging", "accommodation", "guest house", "hostel", "dormitory", "boarding"],
        "Photography & Video": ["photo", "video", "camera", "photography", "videography", "media", "drone", "event coverage", "live stream"],
        "Registration Kit": ["registration", "kit", "bag", "file", "folder", "id card", "badge", "tag", "lanyard", "enrollment"],
        "Mementos & Gifts": ["memento", "gift", "trophy", "medal", "shawl", "presents", "award", "prize", "momento", "souvenir", "certificate frame"],
        "Logistic Support": ["security", "cleaning", "housekeeping", "manpower", "volunteers", "student coordinators", "helpers", "labor"]
    };

    for (const [component, kws] of Object.entries(keywords)) {
        if (kws.some(kw => combinedText.includes(kw))) {
            detectedComponents.push(component);
        }
    }

    const isWorkshop = ["workshop", "training", "hands-on", "bootcamp", "practical"].some(kw => combinedText.includes(kw));
    const isGuestEvent = ["guest", "speaker", "expert", "lecturer", "resource", "keynote"].some(kw => combinedText.includes(kw));
    const isConference = ["conference", "symposium", "seminar", "summit", "meetup", "conclave"].some(kw => combinedText.includes(kw));

    if (isWorkshop) {
        if (!detectedComponents.includes("Event Venue")) detectedComponents.push("Event Venue");
        if (!detectedComponents.includes("Refreshments")) detectedComponents.push("Refreshments");
        if (!detectedComponents.includes("Technical Equipment")) detectedComponents.push("Technical Equipment");
        if (!detectedComponents.includes("Printing")) detectedComponents.push("Printing");

        if (combinedText.includes("software") || combinedText.includes("tool") || combinedText.includes("app")) {
            if (!combinedText.includes("installed") && !combinedText.includes("yes") && !combinedText.includes("no")) {
                nextQuestion = "Is the specific software required for this workshop already installed on the computers?";
            } else if (combinedText.includes("no") && !combinedText.includes("payed") && !combinedText.includes("paid") && !combinedText.includes("free")) {
                nextQuestion = "Understood. Will this be a paid licensed software or is it open-source/free?";
            } else if (combinedText.includes("paid") || combinedText.includes("payed")) {
                if (!detectedComponents.includes("Software License")) detectedComponents.push("Software License");
                nextQuestion = "Got it. I've added 'Software License' to your checklist. Anything else about technical setup?";
            }
        } else {
            nextQuestion = "Great choice! For this workshop, will you be using any specific software or technical tools?";
        }
    }

    return { nextQuestion, checklist: detectedComponents };
};

console.log("--- Testing Conversational Logic ---");

let state = fallbackAnalyzeEvent("AI Workshop", "Workshop");
console.log("Q1 (Initial):", state.nextQuestion);

state = fallbackAnalyzeEvent("AI Workshop", "Yes, we need software");
console.log("Q2 (Software mentioned):", state.nextQuestion);

state = fallbackAnalyzeEvent("AI Workshop", "No, not installed");
console.log("Q3 (Not installed):", state.nextQuestion);

state = fallbackAnalyzeEvent("AI Workshop", "It is paid");
console.log("Final State (Paid):", state.nextQuestion);
console.log("Checklist:", state.checklist);
