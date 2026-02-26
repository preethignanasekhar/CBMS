import spacy
from flask import Flask, request, jsonify
from flask_cors import CORS
import re

app = Flask(__name__)
CORS(app)

# Load spaCy model
try:
    nlp = spacy.load("en_core_web_sm")
except:
    # Fallback if model loading fails
    nlp = None

# Mapping of keywords to event components
COMPONENT_KEYWORDS = {
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
}

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy", "nlp_loaded": nlp is not None})

@app.route('/analyze-event', methods=['POST'])
def analyze_event():
    data = request.json
    event_name = data.get('eventName', '')
    event_description = data.get('eventDescription', '')
    
    combined_text = f"{event_name} {event_description}".lower()
    
    # Process text with spaCy
    doc = nlp(combined_text) if nlp else None
    
    detected_components = []
    
    # Keyword based matching
    for component, keywords in COMPONENT_KEYWORDS.items():
        if any(keyword in combined_text for keyword in keywords):
            detected_components.append(component)
    
    # Smart detection for duration
    days = 1
    duration_match = re.search(r'(\d+)\s*(day|days)', combined_text)
    if duration_match:
        days = int(duration_match.group(1))
    
    # Additional AI logic
    is_workshop = any(kw in combined_text for kw in ["workshop", "training", "hands-on", "bootcamp", "practical"])
    is_guest_event = any(kw in combined_text for kw in ["guest", "speaker", "expert", "lecturer", "resource", "keynote"])
    is_conference = any(kw in combined_text for kw in ["conference", "symposium", "seminar", "summit", "meetup", "conclave"])
    
    # Baseline detections for common event types if nothing detected
    if is_workshop or is_conference:
        if "Event Venue" not in detected_components:
            detected_components.append("Event Venue")
        if "Refreshments" not in detected_components:
            detected_components.append("Refreshments")
        if "Technical Equipment" not in detected_components:
            detected_components.append("Technical Equipment")
            
    if is_conference:
        if "Printing" not in detected_components:
            detected_components.append("Printing")
        if "Photography & Video" not in detected_components:
            detected_components.append("Photography & Video")
        if "Mementos & Gifts" not in detected_components:
            detected_components.append("Mementos & Gifts")
        if "Registration Kit" not in detected_components:
            detected_components.append("Registration Kit")

    if is_workshop:
        if "Printing" not in detected_components:
            detected_components.append("Printing")

    # Dynamic Logic Triggers
    follow_ups = []
    if days > 1:
        follow_ups.append({
            "trigger": "Multi-day event",
            "question": f"Since the event is {days} days, should we include accommodation and daily transport?",
            "category": "Accommodation",
            "itemToAdd": "Accommodation & Daily Travel"
        })
        if "Accommodation" not in detected_components:
            detected_components.append("Accommodation")
            
    if "Food" in detected_components:
        follow_ups.append({
            "trigger": "Food/Catering",
            "question": "Would you like to include water bottles and high-tea for participants?",
            "category": "Refreshments",
            "itemToAdd": "Bottled Water & High-Tea"
        })
        
    if is_guest_event:
        follow_ups.append({
            "trigger": "Guest speaker detected",
            "question": "Should we include a Bouquet, Shawl and Memento for the guest?",
            "category": "Mementos & Gifts",
            "itemToAdd": "Guest Welcome Kit (Shawl/Bouquet)"
        })
        if "Resource Person / Chief Guest" not in detected_components:
            detected_components.append("Resource Person / Chief Guest")
            
    if "Transportation" in detected_components:
        follow_ups.append({
            "trigger": "Transportation needed",
            "question": "Do you need a dedicated driver allowance and fuel contingency?",
            "category": "Transportation",
            "itemToAdd": "Driver Allowance & Fuel"
        })

    if is_workshop:
        follow_ups.append({
            "trigger": "Workshop detected",
            "question": "Need budget for Printing notepads, pens and training kits?",
            "category": "Printing",
            "itemToAdd": "Stationery (Notepads/Pens)"
        })

    # Suggested budget categories (mapping components to internal CBMS categories)
    budget_suggestions = []
    if "Food" in detected_components or "Refreshments" in detected_components:
        budget_suggestions.append("Catering & Refreshments")
    if "Printing" in detected_components:
        budget_suggestions.append("Printing & Stationery")
    if "Technical Equipment" in detected_components:
        budget_suggestions.append("Technical Expenses")
    if is_guest_event:
        budget_suggestions.append("Guest Remuneration")

    return jsonify({
        "status": "success",
        "analysis": {
            "eventName": event_name,
            "detectedComponents": detected_components,
            "durationDays": days,
            "isWorkshop": is_workshop,
            "isGuestEvent": is_guest_event
        },
        "checklist": list(set(detected_components + (["Printing", "Refreshments"] if is_workshop else []))),
        "followUps": follow_ups,
        "budgetSuggestions": list(set(budget_suggestions))
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)
