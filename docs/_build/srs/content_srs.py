# -*- coding: utf-8 -*-
"""Content of the Software Requirements Specification (IT 428 SRS template, IEEE 830)."""
from usecases import USECASES, PROTOTYPES, prototype_parts

SYSTEM = "Revenue Collection and Monitoring System with AI-Integrated Logbook Scanning for NeoFit Fitness Gym"
TITLE_LINES = ["Revenue Collection and Monitoring System with AI-Integrated", "Logbook Scanning for NeoFit Fitness Gym"]  # header
TITLE_PAGE_LINES = ["Revenue Collection and Monitoring System", "with AI-Integrated Logbook Scanning", "for NeoFit Fitness Gym"]  # title page
DOC_TITLE = "Software Requirement Specification"
INFO = [
    ("Document Version", "1.0"),
    ("Date", "September 26, 2026"),
    ("Prepared By", "Jay Mark A. Reños, Liza Mae C. Sugala, Rusel R. Portes, Efren S. Cabudbud Jr., Carl Vey P. Sente, Rayla G. Lanaza"),
    ("Technical Adviser", "Eric Bulala"),
    ("Subject Adviser", "Clark Kevin V. Villamor, MIT — Head, College of Computer Studies"),
    ("Client", "NeoFit Fitness Gym"),
]
ORG = ["College of Computer Studies", "Trinidad Municipal College"]

FIGURES, TABLES = {}, {}
FIG_ORDER, TAB_ORDER = [], []

def fig(key, name, path, width):
    label = f"Figure {len(FIG_ORDER) + 1}.0"
    FIGURES[key] = dict(label=label, name=name, path=path, width=width)
    FIG_ORDER.append(key)
    return ("figure", key)

def tab(key, name, widths, header, rows, **opts):
    label = f"Table {len(TAB_ORDER) + 1}.0"
    TABLES[key] = dict(label=label, name=name, widths=widths, header=header, rows=rows, **opts)
    TAB_ORDER.append(key)
    return ("table", key)

FR_TEXT = {
    "FR-01": "Lets users sign in and sign out, and shows only the features of the user's role: staff, owner or administrator. A disabled staff account cannot sign in.",
    "FR-02": "Lets the staff and the owner capture a logbook page with the camera or import it from the gallery, assign it to today or an earlier date, and see the number of online AI scans left for the day.",
    "FR-03": "Reads member names and payment amounts from the page: online through Google Gemini 2.5 Flash, or offline on the phone through Google ML Kit with automatic text cleanup.",
    "FR-04": "Flags amounts that are not official NeoFit rates and repeated lines, and lets the user edit, delete or add entries before confirming the page.",
    "FR-05": "Saves confirmed pages to the cloud database, keeps them in a local queue when the phone is offline, and uploads the queue automatically later.",
    "FR-06": "Shows the owner the revenue for the day, week, month and year, the revenue history with the staff member who scanned each page, and exports the records as CSV.",
    "FR-07": "Lets the owner see the staff accounts and disable or re-enable them.",
    "FR-08": "Lets the administrator add, edit, renew, view and delete members, record each payment with a receipt number, invite members to the member screens of the mobile application, and see membership alerts on the desktop dashboard.",
    "FR-09": "Lets the administrator view, edit and reset NeoFit's rate table, which all revenue computations use, and post or remove the announcements that members see.",
    "FR-10": "Lets the administrator view the synchronized logbook entries by date, and add, edit or delete entries.",
    "FR-11": "Computes and charts revenue from the logbook scans and the member payments, counting each payment once, and exports a Word revenue report.",
    "FR-12": "Lets an invited member sign in to the mobile application with an email link, without a password, and see their own plan, expiry date, days left and status, together with NeoFit's rates and announcements. Members cannot pay in the application; they renew at the front desk.",
    "FR-13": "Shows a signed-in member only the payments recorded on their own member record, and gives a receipt for each payment that can be saved as a PDF file or shared.",
    "FR-14": "Sends an invited member a push notification 7, 3 and 1 day before the plan expires, reminding them to renew at the front desk, and shows the same reminder on the member's Home screen.",
}

DOC = []
add = DOC.append

# ============================ 1. Overview ============================
add(("h1", "Overview"))
add(("p", "This Software Requirements Specification (SRS) defines what the Revenue Collection and Monitoring System with AI-Integrated Logbook Scanning for NeoFit Fitness Gym must do. It describes the product, its users and its functions, the constraints and assumptions behind it, and the specific functional and non-functional requirements that the finished system must satisfy. It is the reference for design, development and testing: the Software Design Description (SDD) explains how these requirements are met, and the Software Test Document (STD) verifies them."))
add(("p", "NeoFit Fitness Gym records every member visit and payment by hand in a paper logbook, one “name – amount” line per entry, and these pages are its only record. The revenue for a day, a month or a year must be added up by hand, page by page, which is slow and error-prone: misread digits, wrong amounts and lines written twice flow into the totals unnoticed. Encoding the logbook into a system by hand would be just as slow and tiring for the staff, line by line. Paper records are also hard to search and summarize, and they can be lost or damaged."))
add(("p", "The system keeps the paper logbook and turns it into revenue records. The staff photograph a page with the mobile application; an artificial intelligence (AI) optical character recognition (OCR) engine reads the handwritten names and amounts, so that nobody has to encode them; the system checks each amount against NeoFit's rate table; and the staff confirm the entries before they are saved. A desktop application for the gym turns the records into revenue analytics and reports, and also manages members and rates. Members of the gym can sign in to the mobile application to see their own membership, payments and receipts, and they are reminded before their plans expire, so that they renew on time at the front desk."))

add(("h2", "Project Summary"))
add(("p", "The Revenue Collection and Monitoring System with AI-Integrated Logbook Scanning is a mobile and desktop system for NeoFit Fitness Gym. The mobile application, used by the staff and the owner, captures logbook pages and reads them with a two-tier OCR engine: Google Gemini 2.5 Flash when the phone is online, and Google ML Kit on the device when it is offline. Every amount is compared with the gym's official rate table so that unusual values are flagged for the staff, and no page is saved until a person confirms it."))
add(("p", "Confirmed pages are stored in a cloud database on Supabase, or kept in a queue on the phone until a connection is available. The owner follows the revenue from the phone, and the administrator uses a Windows desktop application to manage members, rates and logbook entries, and to view revenue analytics that combine the logbook scans and the member payments. Invited members use the same mobile application, or its web version, to see their own membership status, payment history and receipts, NeoFit's rates and the gym's announcements, and they receive push reminders before their plans expire. Members still pay at the front desk; the system does not accept online payments. Overall, the system aims to remove manual tallying and encoding, reduce errors, support on-time renewals, and give NeoFit accurate and timely revenue information."))

add(("h2", "Definition, Acronyms, and Abbreviations"))
add(("p", "The table below defines the terms, acronyms and abbreviations used in this document."))
add(tab("terms", "Definition of Terms", [2.0, 4.5], ["Terms", "Definition"], [
    ["The system", "The Revenue Collection and Monitoring System with AI-Integrated Logbook Scanning for NeoFit Fitness Gym, specified in this document."],
    ["NeoFit Fitness Gym", "The client organization for which the system is developed."],
    ["Logbook", "The paper notebook in which the gym staff handwrite the daily member visits and payments, one “name – amount” line per entry."],
    ["Logbook Scanning", "Photographing a logbook page so that AI reads its entries, instead of encoding them by hand."],
    ["Upload", "One captured logbook page together with the entries saved from it."],
    ["Entry", "One line of the logbook: a member name and, when written, a payment amount."],
    ["OCR", "Optical Character Recognition. Technology that converts the text in an image into machine-readable text."],
    ["AI", "Artificial Intelligence. In this document, a machine learning model that reads handwriting from images."],
    ["Google Gemini 2.5 Flash", "A multimodal AI model by Google, used through its API to read logbook pages when the phone is online."],
    ["Google ML Kit", "Google's on-device machine learning library, used to read pages when the phone is offline."],
    ["Rate Table", "NeoFit's official price list for each plan: regular or student/senior; monthly, semi-monthly or daily; with or without treadmill."],
    ["Offline Queue", "Storage on the phone that holds confirmed pages until they can be uploaded."],
    ["Synchronization", "The process of uploading the pages in the offline queue to the cloud database."],
    ["Reconciliation", "Combining the revenue from the logbook scans and the member payments so that each payment is counted only once."],
    ["Member Screens", "The part of the mobile application for gym members: Home, Payments, and Rates and announcements. Each member sees only their own records."],
    ["Invite", "An email sent by the system, at the administrator's request, that gives a member access to the member screens."],
    ["Email Link Sign-In", "Signing in without a password: the system emails a one-time link that signs the user in when it is opened."],
    ["Receipt", "The record of one member payment, with a receipt number, shown in the member's payment history. It acknowledges the payment and is not an official receipt of the Bureau of Internal Revenue (BIR)."],
    ["Renewal Reminder", "A notification that tells a member that the plan expires in 7, 3 or 1 days."],
    ["Push Notification", "A message sent to a phone that appears even when the application is closed."],
    ["Expo Push Service", "The notification service of the Expo platform, which delivers push notifications to Android phones."],
    ["Announcement", "A short notice from the gym, posted by the administrator and shown in the member screens."],
    ["Web Version", "The member screens opened in a web browser, for members who do not use an Android phone."],
    ["Supabase", "A cloud platform that provides the PostgreSQL database and user authentication of the system."],
    ["Row-Level Security (RLS)", "A database feature that restricts which records each user may read or change."],
    ["SQLite", "A lightweight database embedded in the desktop application."],
    ["Actor", "A person or an external system that interacts with the system."],
    ["Use Case", "A description of how an actor uses the system to reach a goal, shown as a diagram and a description."],
    ["«include»", "A use case relationship in which one use case always performs the behavior of another."],
    ["Prototype", "A model of the planned screens of the system, used to visualize and validate the requirements before development."],
    ["Functional Requirement (FR)", "A statement of a function that the system must perform."],
    ["Non-Functional Requirement", "A statement of a quality the system must have, such as performance, reliability or security."],
    ["Staff", "Front-desk personnel who scan and review logbook pages."],
    ["Owner", "The gym owner, who monitors revenue and manages staff accounts."],
    ["Administrator", "The user of the desktop application who manages members, rates and logbook entries."],
    ["Member", "A NeoFit member who has been invited to the member screens of the mobile application."],
    ["CSV", "Comma-Separated Values. A plain-text file format for tabular data."],
    ["UI", "User Interface."],
]))

add(("h2", "References"))
add(("refs", [
    "IEEE, “IEEE Std 830-1998: IEEE Recommended Practice for Software Requirements Specifications.” 1998.",
    "International Organization for Standardization, “ISO/IEC 25010:2011 – Systems and software Quality Requirements and Evaluation (SQuaRE) – System and software quality models.” 2011.",
    "J. Memon, M. Sami and R. A. Khan, “Handwritten Optical Character Recognition (OCR): A Comprehensive Systematic Literature Review (SLR),” IEEE Access, vol. 8, pp. 142642–142668, 2020. doi: 10.1109/ACCESS.2020.3012542",
    "U.-V. Marti and H. Bunke, “The IAM-database: an English sentence database for offline handwriting recognition,” International Journal on Document Analysis and Recognition, vol. 5, no. 1, pp. 39–46, 2002. doi: 10.1007/s100320200071",
    "Gemini Team, Google, “Gemini: A Family of Highly Capable Multimodal Models,” arXiv:2312.11805, 2023.",
    "Google, “Gemini API Documentation.” Web. https://ai.google.dev/gemini-api/docs Accessed 2026.",
    "Google, “ML Kit Text Recognition v2.” Web. https://developers.google.com/ml-kit/vision/text-recognition/v2 Accessed 2026.",
    "Supabase, “Row Level Security.” Web. https://supabase.com/docs/guides/database/postgres/row-level-security Accessed 2026.",
    "Supabase, “Passwordless email logins.” Web. https://supabase.com/docs/guides/auth/auth-email-passwordless Accessed 2026.",
    "Expo, “Push notifications overview.” Web. https://docs.expo.dev/push-notifications/overview/ Accessed 2026.",
    "Meta Platforms, Inc., “React Native Documentation.” Web. https://reactnative.dev/docs/getting-started Accessed 2026.",
    "OpenJS Foundation, “Electron Documentation.” Web. https://www.electronjs.org/docs Accessed 2026.",
    "OWASP Foundation, “OWASP Mobile Application Security Verification Standard (MASVS).” Web. https://mas.owasp.org/MASVS/ Accessed 2026.",
    "OWASP Foundation, “OWASP Top 10: The Ten Most Critical Web Application Security Risks.” Web. https://owasp.org/www-project-top-ten/ Accessed 2026.",
    "Republic of the Philippines, “Republic Act No. 10173: Data Privacy Act of 2012.” 2012.",
]))

# ============================ 2. Overall Description ============================
add(("h1", "Overall Description"))
add(("p", "This section describes the system as a whole: its place among NeoFit's existing tools, its main functions, its users, and the constraints, assumptions and dependencies that shape the requirements in Section 3."))

add(("h2", "Product Perspective"))
add(("p", "The system is new and self-contained. It does not replace NeoFit's paper logbook; it works alongside it, so the front desk keeps writing entries as it does today. The system connects to three cloud services: the Google Gemini API for online reading of pages, Supabase for the database and user authentication, and the Expo Push Service for the renewal reminders sent to members."))
add(fig("overview", "System Overview", "fig/overview.png", 6.3))
add(("p", "The mobile application captures and reads the pages. It uses the Gemini API when online and Google ML Kit on the phone when offline, and it uploads confirmed pages to Supabase or queues them until a connection is available. The desktop application runs on the gym's Windows computer. It keeps members, payments, rates and settings in a local SQLite database, reads the synchronized logbook data from Supabase, and combines both sources into revenue analytics and reports. It also publishes to Supabase copies of the records that invited members may see: their membership, their payments, the rates and the announcements. The member screens read only these copies, so a member never sees the logbook or the records of other members."))

add(("h2", "Product Functions"))
add(("p", "From the viewpoint of its users, the system performs the following functions. The identifiers are used throughout the SPMP, the SDD and the STD."))
add(("bullets", [f"**{fr} {uc['name']}:** {FR_TEXT[fr]}" for uc in USECASES for fr in [uc["fr"]]]))
add(("p", "The table below traces each functional requirement to its use case and its prototype in Section 3.2."))
add(tab("trace", "Functional Requirements Traceability", [0.8, 3.3, 1.2, 1.2], ["FR", "Function", "Use Case", "Prototype"],
        [[uc["fr"], uc["name"], uc["id"], uc["pr"]] for uc in USECASES]))

add(("h2", "User Characteristics"))
add(("p", "The users of the system are identified and described as follows:"))
add(("bullets", [
    "**Staff:** Front-desk personnel who write the logbook and scan it with the mobile application. They are familiar with smartphones but are not technical users, so the scanning flow must take only a few taps.",
    "**Owner:** The gym owner, who uses the mobile application to monitor revenue, review uploads and manage staff accounts. The owner can also scan pages.",
    "**Administrator:** The person who operates the desktop application at the gym, usually the owner or a trusted staff member. The administrator manages members, rates and logbook entries and views revenue analytics.",
    "**Members:** NeoFit members invited by the administrator. They use the member screens of the mobile application, or its web version, to see their own membership, payments and receipts, the rates and the announcements, and they receive renewal reminders. Their experience with smartphones varies, so the member screens show only a few large, read-only items.",
]))
add(("p", "Three external systems also act on the system: the **Google Gemini API**, which reads page images; **Supabase Cloud**, which stores records, verifies users and runs the daily reminder check; and the **Expo Push Service**, which delivers the reminders to the members' phones."))

add(("h2", "Constraints"))
add(("p", "A constraint is a limitation that must be respected throughout development and operation. Hard constraints are mandatory; soft constraints are qualities the system should achieve."))
add(("h3", "Hard Constraints"))
add(("bullets", [
    "**Human confirmation:** No extracted entry may be saved until a user has reviewed and confirmed the page.",
    "**No invented amounts:** When a digit cannot be read, the amount must be left blank rather than guessed.",
    "**Offline capture:** Capturing, reading and confirming a page must work without an internet connection.",
    "**No lost pages:** A confirmed page must be kept on the phone until it is uploaded successfully.",
    "**Access control:** Users may only reach the functions and records of their role, enforced by the database as well as the application. A member may see only their own membership and payments.",
    "**Invited members only:** Only members invited by the administrator can sign in to the member screens, and only the records of invited members are copied to the cloud database.",
    "**No online payment:** The system records the payments made at the front desk but does not accept payments; members pay and renew only at the front desk.",
    "**Data privacy:** The handling of member names and payments must comply with the Data Privacy Act of 2012 (Republic Act No. 10173).",
    "**Platforms:** The mobile application must run on Android, and its member screens must also run as a web version in a current web browser; the desktop application must run on Windows.",
    "**AI quota:** Online AI scans are limited to five per day, reset at 8:00 AM, to stay within the Gemini API quota.",
]))
add(("h3", "Soft Constraints"))
add(("bullets", [
    "**Ease of use:** The interface should be simple enough for front-desk staff to use during busy hours without training beyond a short orientation.",
    "**Fast response:** The system should return results within the times given in Section 3.3.1.",
    "**Low resource use:** The mobile application should keep images small and the offline queue compact.",
    "**Accuracy:** The OCR engine should read most entries of a legible page correctly, so that the staff correct only a few rows.",
    "**Simple member screens:** The member screens should show only a few large, read-only items, so that members of any age can use them.",
    "**Maintainability:** The system should allow rates, features and fixes to be updated without reinstalling it from scratch.",
]))

add(("h2", "Assumptions and Dependencies"))
add(("p", "The following assumptions and dependencies apply to the requirements in this document:"))
add(("bullets", [
    "**Logbook practice:** NeoFit continues to record member visits and payments in its paper logbook, with each line holding a name and an amount (“name – amount”).",
    "**Legibility:** Entries are handwritten legibly enough for a person to read them.",
    "**Devices:** The staff and the owner have Android smartphones with a working camera, and the gym has a Windows computer for the desktop application. Members who use the member screens have an Android phone or a phone with a current web browser.",
    "**Member contact:** Members who want access to the member screens give the front desk an email address that they can open on their phone.",
    "**Connectivity:** Internet access at the gym is available most of the time; online reading, synchronization and logbook editing on the desktop depend on it.",
    "**Third-party services:** The Google Gemini API, Supabase and the Expo Push Service remain available under their current free tiers and terms of use.",
    "**Accounts:** Staff and owner accounts are created by the owner in the cloud authentication service, and the owner keeps them up to date. Member accounts are created only through invites from the desktop application.",
    "**Correct rates:** The administrator keeps the rate table in the desktop application up to date, and the mobile rate check uses the same official rates.",
]))

# ============================ 3. Specific Requirements ============================
add(("h1", "Specific Requirements"))
add(("p", "This section specifies the requirements that the design must satisfy and that testing must verify: the external interfaces, the functional requirements as use cases and prototypes, the performance requirements, the design constraints and the software system attributes."))

add(("h2", "External Interfaces Requirements"))
add(("p", "This subsection specifies the hardware and software with which the system and its components must interface."))
add(("h3", "Hardware Interfaces"))
add(("p", "The system runs on the staff's and owner's Android phones and on the gym's Windows computer. The table below lists the minimum hardware."))
add(tab("hardware", "Minimum Hardware Requirements", [1.5, 3.6, 1.4], ["Device", "Minimum Requirement", "Used By"], [
    ["Android smartphone", ["Android 7.0 (API level 24) or later", "Rear camera with autofocus (staff and owner)", "3 GB RAM; 1 GB free storage", "Wi-Fi or mobile data"], "Staff, Owner, Members"],
    ["Other smartphone", ["A current version of Chrome or Safari, for the web version of the member screens"], "Members"],
    ["Windows computer", ["Windows 10 or later, 64-bit", "Dual-core 2.0 GHz processor; 4 GB RAM", "500 MB free storage", "1366 × 768 display"], "Administrator"],
    ["Network", ["Internet access through Wi-Fi or mobile data for online reading, synchronization, the member screens and updates"], "All users"],
]))
add(("h3", "Software Interfaces"))
add(("p", "The system is built from the software components and services listed below."))
add(tab("software", "Software Interfaces", [1.7, 2.5, 2.3], ["Interface", "Technology", "Purpose"], [
    ["Mobile application", "React Native (Expo), TypeScript", "Application for the staff, the owner and members; the member screens also run in a web browser"],
    ["Online OCR service", "Google Gemini API (Gemini 2.5 Flash) over HTTPS", "Reads page images and returns entries as JSON"],
    ["Offline OCR library", "Google ML Kit Text Recognition", "Reads page images on the phone"],
    ["Cloud database and authentication", "Supabase: PostgreSQL, Auth and Row-Level Security over HTTPS", "Stores profiles, uploads, entries and the copies of member records; signs users in, also with email links"],
    ["Cloud functions", "Supabase Edge Functions, run daily by a schedule (pg_cron)", "Send member invites and the daily renewal reminders"],
    ["Push notifications", "Expo Notifications and the Expo Push Service", "Deliver renewal reminders to the members' phones"],
    ["Receipt export", "Expo Print and Expo Sharing", "Save a receipt as a PDF file and share it"],
    ["Mobile local storage", "AsyncStorage and Secure Store", "Holds the offline queue and the session"],
    ["Desktop application", "Electron, React, Vite", "Application for the administrator"],
    ["Local desktop API", "Express (Node.js), reachable only from the same computer", "Serves data to the desktop interface"],
    ["Local desktop database", "SQLite", "Stores members, payments, rates and settings"],
    ["Report export", "Word (.docx) document library", "Produces the revenue report"],
    ["Updates", "GitHub Releases for the desktop; Expo EAS for the mobile application", "Delivers new versions to the users"],
]))

add(("h2", "Functional Requirements"))
add(("p", "The functional requirements FR-01 to FR-14 are specified as fourteen use cases. Each use case has a diagram and a description of its actors, preconditions, main flow, alternative flows and postconditions. Section 3.2.2 presents the prototype screens that realize each use case."))
add(("h3", "Use Case"))
for uc in USECASES:
    add(("h4", f"({uc['id']}) {uc['name']} Use Case"))
    add(("pk", f"{uc['desc']} This use case realizes {uc['fr']}."))
    wide = 6.3 if uc["right"] else 5.9
    if len(uc["a"]) > 5:
        wide = 4.6
    add(fig(uc["id"], f"{uc['name']} Use Case", f"fig/{uc['id']}.png", wide))
    actors = ", ".join(uc["left"] + uc["right"])
    add(tab(uc["id"] + "-desc", f"{uc['id']} {uc['name']} Description", [1.6, 4.9], None, [
        ["Use Case ID", uc["id"]],
        ["Use Case Name", uc["name"]],
        ["Actors", actors],
        ["Description", uc["desc"]],
        ["Preconditions", uc["pre"]],
        ["Main Flow", [f"{i}. {s}" for i, s in enumerate(uc["flow"], 1)]],
        ["Alternative Flows", uc["alt"]],
        ["Postconditions", uc["post"]],
    ], kv=True))

add(("h3", "Prototype"))
add(("p", "The prototype screens below are the interface designs of the system, shown with sample data. Phone screens belong to the mobile application; wide screens belong to the desktop application."))
for uc in USECASES:
    names, caption = PROTOTYPES[uc["pr"]]
    add(("h4", f"({uc['pr']}) {uc['name']} Prototype"))
    add(("pk", caption))
    for k, (key, part) in enumerate(prototype_parts(uc["pr"], names)):
        if part[0].startswith("m-"):
            width = {1: 2.5, 2: 4.9}.get(len(part), 6.3)
        else:
            width = 6.3 if len(part) == 1 else 5.2
        add(fig(key, f"{uc['name']} Prototype" + (" (continued)" if k else ""), f"fig/{key}.png", width))

add(("h2", "Performance Requirements"))
add(("p", "These requirements describe how quickly and efficiently the system must perform its functions. They assume the minimum hardware in Table 3.0 and a normal mobile or Wi-Fi connection, and they will be verified in the Software Test Document."))
add(("h3", "Execution Time"))
add(("p", "The system shall complete the following operations within the times given:"))
add(tab("times", "Execution Time Requirements", [3.6, 2.9], ["Operation", "Requirement"], [
    ["Sign in", "Within 5 seconds"],
    ["Read one page online (Gemini 2.5 Flash)", "Entries shown within 30 seconds"],
    ["Read one page offline (ML Kit)", "Entries shown within 5 seconds"],
    ["Save a confirmed page while online", "Within 10 seconds"],
    ["Synchronize a queued page after the connection returns", "Within 10 seconds per page"],
    ["Open the owner's revenue dashboard", "Within 5 seconds"],
    ["Open a desktop view (members, rates, logbook)", "Within 3 seconds, with up to 1,000 members"],
    ["Compute and display one month of revenue analytics", "Within 5 seconds"],
    ["Generate the Word revenue report", "Within 10 seconds"],
    ["Open the member's Home or Payments screen", "Within 3 seconds"],
    ["Save a receipt as a PDF file", "Within 5 seconds"],
    ["Send the daily renewal reminders", "All reminders sent within 10 minutes after 8:00 AM"],
]))
add(("h3", "Efficiency"))
add(("p", "The system shall use device, network and service resources sparingly. The mobile application shall resize each page image to a width of 1,600 pixels and compress it before reading or uploading it, and it shall store queued pages as compact records without the image. Online AI reading shall be limited to five scans per day, while the offline reader has no limit. The desktop application shall keep its data in a single local SQLite database file and shall reuse recently fetched logbook data instead of querying the cloud database on every screen. The member screens shall load only the signed-in member's records, and the reminder check shall run once a day."))

add(("h2", "Design Constraints"))
add(("h3", "Software Language"))
add(("p", "The mobile application shall be written in TypeScript with React Native and Expo. The desktop application shall be written in TypeScript and JavaScript with Electron, React and Vite, with a local API in Node.js and Express. Data shall be stored in PostgreSQL on Supabase, accessed through the Supabase client libraries and protected by SQL row-level security policies, and in SQLite on the desktop."))
add(("h3", "Graphical-User Interface"))
add(("p", "The mobile interface shall use a dark theme with a high-contrast mint accent, large touch targets, and bottom tabs that depend on the role: Scan and History for the staff; Dashboard, Scan, History, Staff and Settings for the owner; and Home, Payments and Rates for members. The desktop interface shall use a sidebar with Dashboard, Members, Rates, Revenue and Logbook, and shall offer light and dark modes. Amounts shall be shown in Philippine pesos and dates in the Philippine format. Screens shall be designed in Figma and kept consistent with the prototypes in Section 3.2.2."))

add(("h2", "Software System Attributes"))
add(("p", "The system must have the following quality attributes."))
add(("h3", "Reliability"))
add(("p", "The system shall produce correct and consistent records. No page shall be saved without a user's confirmation, and no amount shall be invented by the OCR engine. A confirmed page shall never be lost: it stays in the offline queue until an upload succeeds. Revenue computations shall count each payment once, even when the same payment appears in both a member payment and a logbook scan, and they shall match a manual tally of the same days. Each payment recorded on the desktop shall appear once in the member's payment history with a unique receipt number, and a renewal reminder shall be sent at most once per reminder day."))
add(("h3", "Availability"))
add(("p", "Scanning shall remain available when the internet connection or the Gemini API is down, because the offline reader and the offline queue take over. The desktop application's member and rate functions shall work without internet access, since they use the local database; logbook editing and the logbook part of revenue analytics require access to the cloud database. The member screens and the renewal reminders require an internet connection; member records changed while the desktop computer is offline shall be published when the connection returns. The system depends on the availability of Supabase, the Gemini API and the Expo Push Service under their service terms."))
add(("h3", "Security"))
add(("p", "Every user shall sign in before using the system, and each role shall reach only its own functions. Row-level security in the cloud database shall ensure that a staff account can only create uploads under its own identity, and a disabled staff account shall not be able to sign in. All traffic between the applications and the cloud services shall be encrypted with HTTPS. The desktop application shall store passwords only as hashes, expire sessions after 24 hours, and accept API requests only from the same computer. Service keys and passwords shall be kept in configuration files outside the source code. Member accounts shall be created only by invitation from the desktop application, and sign-up without an invitation shall be disabled. Row-level security shall let a member read only their own membership and payments; members shall have no access to the logbook, the uploads, the staff profiles or the records of other members. Only the records of invited members shall be copied to the cloud database. Member information shall be collected and used only for the purposes of the system, in line with the Data Privacy Act of 2012."))
add(("h3", "Maintainability"))
add(("p", "The code shall be organized into separate screens, services and data-access modules, written in TypeScript where possible, and kept in a Git repository. The rate table shall be defined in one place for revenue computations. New versions of the mobile application shall be deliverable through Expo EAS updates, and the desktop application shall update itself from GitHub Releases, so that fixes reach NeoFit without manual reinstallation."))
add(("h3", "Portability"))
add(("p", "The mobile application shall run on Android 7.0 or later, and its member screens shall also run as a web version in current browsers; because it is built with React Native and Expo, it can be built for iOS in the future without a rewrite. The desktop application shall run on Windows 10 or later. Records shall be stored in standard PostgreSQL and SQLite databases and can be exported as CSV and Word files, so the data is not locked into the application."))

FIG_ENTRIES = [(FIGURES[k]["label"], FIGURES[k]["name"]) for k in FIG_ORDER]
TAB_ENTRIES = [(TABLES[k]["label"], TABLES[k]["name"]) for k in TAB_ORDER]
