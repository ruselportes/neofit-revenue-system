# Software Requirement Specification

*for*

**Revenue Collection and Monitoring System with AI-Integrated Logbook Scanning for NeoFit Fitness Gym**



## 1. Overview

This Software Requirements Specification (SRS) defines what the Revenue Collection and Monitoring System with AI-Integrated Logbook Scanning for NeoFit Fitness Gym must do. It describes the product, its users and its functions, the constraints and assumptions behind it, and the specific functional and non-functional requirements that the finished system must satisfy. It is the reference for design, development and testing: the Software Design Description (SDD) explains how these requirements are met, and the Software Test Document (STD) verifies them.

NeoFit Fitness Gym records every member visit and payment by hand in a paper logbook, one “name – amount” line per entry, and these pages are its only record. The revenue for a day, a month or a year must be added up by hand, page by page, which is slow and error-prone: misread digits, wrong amounts and lines written twice flow into the totals unnoticed. Encoding the logbook into a system by hand would be just as slow and tiring for the staff, line by line. Paper records are also hard to search and summarize, and they can be lost or damaged.

The system keeps the paper logbook and turns it into revenue records. The staff photograph a page with the mobile application; an artificial intelligence (AI) optical character recognition (OCR) engine reads the handwritten names and amounts, so that nobody has to encode them; the system checks each amount against NeoFit's rate table; and the staff confirm the entries before they are saved. A desktop application for the gym turns the records into revenue analytics and reports, and also manages members and rates. Members of the gym can sign in to the mobile application to see their own membership, payments and receipts, and they are reminded before their plans expire, so that they renew on time at the front desk.


### 1.1. Project Summary

The Revenue Collection and Monitoring System with AI-Integrated Logbook Scanning is a mobile and desktop system for NeoFit Fitness Gym. The mobile application, used by the staff and the owner, captures logbook pages and reads them with a two-tier OCR engine: Google Gemini 2.5 Flash when the phone is online, and Google ML Kit on the device when it is offline. Every amount is compared with the gym's official rate table so that unusual values are flagged for the staff, and no page is saved until a person confirms it.

Confirmed pages are stored in a cloud database on Supabase, or kept in a queue on the phone until a connection is available. The owner follows the revenue from the phone, and the administrator uses a Windows desktop application to manage members, rates and logbook entries, and to view revenue analytics that combine the logbook scans and the member payments. Invited members use the same mobile application to see their own membership status, payment history and receipts, NeoFit's rates and the gym's announcements, and they receive push reminders before their plans expire. Members still pay at the front desk; the system does not accept online payments. Overall, the system aims to remove manual tallying and encoding, reduce errors, support on-time renewals, and give NeoFit accurate and timely revenue information.


### 1.2. Definition, Acronyms, and Abbreviations

The table below defines the terms, acronyms and abbreviations used in this document.

| Terms | Definition |
|---|---|
| The system | The Revenue Collection and Monitoring System with AI-Integrated Logbook Scanning for NeoFit Fitness Gym, specified in this document. |
| NeoFit Fitness Gym | The client organization for which the system is developed. |
| Logbook | The paper notebook in which the gym staff handwrite the daily member visits and payments, one “name – amount” line per entry. |
| Logbook Scanning | Photographing a logbook page so that AI reads its entries, instead of encoding them by hand. |
| Upload | One captured logbook page together with the entries saved from it. |
| Entry | One line of the logbook: a member name and, when written, a payment amount. |
| OCR | Optical Character Recognition. Technology that converts the text in an image into machine-readable text. |
| AI | Artificial Intelligence. In this document, a machine learning model that reads handwriting from images. |
| Google Gemini 2.5 Flash | A multimodal AI model by Google, used through its API to read logbook pages when the phone is online. |
| Google ML Kit | Google's on-device machine learning library, used to read pages when the phone is offline. |
| Rate Table | NeoFit's official price list for each plan: regular or student/senior; monthly, semi-monthly or daily; with or without treadmill. |
| Offline Queue | Storage on the phone that holds confirmed pages until they can be uploaded. |
| Synchronization | The process of uploading the pages in the offline queue to the cloud database. |
| Reconciliation | Combining the revenue from the logbook scans and the member payments so that each payment is counted only once. |
| Member Screens | The part of the mobile application for gym members: Home, Payments, Rates and announcements, and Account. Each member sees only their own records. |
| Invite | An email sent by the system, at the administrator's request, that gives a member access to the member screens. |
| Email Code | A one-time number that the system emails to an invited member, used to sign in for the first time or after the password is forgotten. It works once and expires after one hour. |
| Receipt | The record of one member payment, with a receipt number, shown in the member's payment history. It acknowledges the payment and is not an official receipt of the Bureau of Internal Revenue (BIR). |
| Renewal Reminder | A notification that tells a member that the plan expires in 7, 3 or 1 days. |
| Push Notification | A message sent to a phone that appears even when the application is closed. |
| Expo Push Service | The notification service of the Expo platform, which delivers push notifications to Android phones. |
| Announcement | A short notice from the gym, posted by the administrator and shown in the member screens. |
| Supabase | A cloud platform that provides the PostgreSQL database and user authentication of the system. |
| Row-Level Security (RLS) | A database feature that restricts which records each user may read or change. |
| SQLite | A lightweight database embedded in the desktop application. |
| Actor | A person or an external system that interacts with the system. |
| Use Case | A description of how an actor uses the system to reach a goal, shown as a diagram and a description. |
| «include» | A use case relationship in which one use case always performs the behavior of another. |
| Prototype | A model of the planned screens of the system, used to visualize and validate the requirements before development. |
| Functional Requirement (FR) | A statement of a function that the system must perform. |
| Non-Functional Requirement | A statement of a quality the system must have, such as performance, reliability or security. |
| Staff | Front-desk personnel who scan and review logbook pages. |
| Owner | The gym owner, who monitors revenue and manages staff accounts. |
| Administrator | The user of the desktop application who manages members, rates and logbook entries. |
| Member | A NeoFit member who has been invited to the member screens of the mobile application. |
| CSV | Comma-Separated Values. A plain-text file format for tabular data. |
| UI | User Interface. |

*Table 1.0 Definition of Terms*


### 1.3. References

[1] IEEE, “IEEE Std 830-1998: IEEE Recommended Practice for Software Requirements Specifications.” 1998.  
[2] International Organization for Standardization, “ISO/IEC 25010:2011 – Systems and software Quality Requirements and Evaluation (SQuaRE) – System and software quality models.” 2011.  
[3] J. Memon, M. Sami and R. A. Khan, “Handwritten Optical Character Recognition (OCR): A Comprehensive Systematic Literature Review (SLR),” IEEE Access, vol. 8, pp. 142642–142668, 2020. doi: 10.1109/ACCESS.2020.3012542  
[4] U.-V. Marti and H. Bunke, “The IAM-database: an English sentence database for offline handwriting recognition,” International Journal on Document Analysis and Recognition, vol. 5, no. 1, pp. 39–46, 2002. doi: 10.1007/s100320200071  
[5] Gemini Team, Google, “Gemini: A Family of Highly Capable Multimodal Models,” arXiv:2312.11805, 2023.  
[6] Google, “Gemini API Documentation.” Web. https://ai.google.dev/gemini-api/docs Accessed 2026.  
[7] Google, “ML Kit Text Recognition v2.” Web. https://developers.google.com/ml-kit/vision/text-recognition/v2 Accessed 2026.  
[8] Supabase, “Row Level Security.” Web. https://supabase.com/docs/guides/database/postgres/row-level-security Accessed 2026.  
[9] Supabase, “Passwordless email logins.” Web. https://supabase.com/docs/guides/auth/auth-email-passwordless Accessed 2026.  
[10] Expo, “Push notifications overview.” Web. https://docs.expo.dev/push-notifications/overview/ Accessed 2026.  
[11] Meta Platforms, Inc., “React Native Documentation.” Web. https://reactnative.dev/docs/getting-started Accessed 2026.  
[12] OpenJS Foundation, “Electron Documentation.” Web. https://www.electronjs.org/docs Accessed 2026.  
[13] OWASP Foundation, “OWASP Mobile Application Security Verification Standard (MASVS).” Web. https://mas.owasp.org/MASVS/ Accessed 2026.  
[14] OWASP Foundation, “OWASP Top 10: The Ten Most Critical Web Application Security Risks.” Web. https://owasp.org/www-project-top-ten/ Accessed 2026.  
[15] Republic of the Philippines, “Republic Act No. 10173: Data Privacy Act of 2012.” 2012.  


## 2. Overall Description

This section describes the system as a whole: its place among NeoFit's existing tools, its main functions, its users, and the constraints, assumptions and dependencies that shape the requirements in Section 3.


### 2.1. Product Perspective

The system is new and self-contained. It does not replace NeoFit's paper logbook; it works alongside it, so the front desk keeps writing entries as it does today. The system connects to three cloud services: the Google Gemini API for online reading of pages, Supabase for the database and user authentication, and the Expo Push Service for the renewal reminders sent to members.

![Figure 1.0 System Overview](assets/srs/overview.png)

*Figure 1.0 System Overview*

The mobile application captures and reads the pages. It uses the Gemini API when online and Google ML Kit on the phone when offline, and it uploads confirmed pages to Supabase or queues them until a connection is available. The desktop application runs on the gym's Windows computer. It keeps members, payments, rates and settings in a local SQLite database, reads the synchronized logbook data from Supabase, and combines both sources into revenue analytics and reports. It also publishes to Supabase copies of the records that invited members may see: their membership, their payments, the rates and the announcements. The member screens read only these copies, so a member never sees the logbook or the records of other members.


### 2.2. Product Functions

From the viewpoint of its users, the system performs the following functions. The identifiers are used throughout the SPMP, the SDD and the STD.

- **FR-01 User Authentication and Role-Based Access:** Lets users sign in and sign out, and shows only the features of the user's role: staff, owner or administrator. A disabled staff account cannot sign in.
- **FR-02 Logbook Page Capture:** Lets the staff and the owner capture a logbook page with the camera or import it from the gallery, assign it to today or an earlier date, and see the number of online AI scans left for the day.
- **FR-03 Hybrid AI OCR Extraction:** Reads member names and payment amounts from the page: online through Google Gemini 2.5 Flash, or offline on the phone through Google ML Kit with automatic text cleanup.
- **FR-04 Entry Validation and Review:** Flags amounts that are not official NeoFit rates and repeated lines, and lets the user edit, delete or add entries before confirming the page.
- **FR-05 Offline Queue and Synchronization:** Saves confirmed pages to the cloud database, keeps them in a local queue when the phone is offline, and uploads the queue automatically later.
- **FR-06 Owner Revenue Monitoring:** Shows the owner the revenue for the day, week, month and year, the revenue history with the staff member who scanned each page, and exports the records as CSV.
- **FR-07 Staff Account Management:** Lets the owner see the staff accounts and disable or re-enable them.
- **FR-08 Member Management:** Lets the administrator add, edit, renew, view and delete members, record each payment with a receipt number, invite members to the member screens of the mobile application, and see membership alerts on the desktop dashboard.
- **FR-09 Rates and Announcements Management:** Lets the administrator view, edit and reset NeoFit's rate table, which all revenue computations use, and post or remove the announcements that members see.
- **FR-10 Logbook Management:** Lets the administrator view the synchronized logbook entries by date, and add, edit or delete entries.
- **FR-11 Revenue Analytics and Reports:** Computes and charts revenue from the logbook scans and the member payments, counting each payment once, and exports a Word revenue report.
- **FR-12 Member Sign-In and Membership Status:** Lets an invited member sign in to the mobile application with an email address and password, using a one-time code sent by email to create the password the first time or after forgetting it, lets the member change the password, and shows the member their own plan, expiry date, days left and status, together with NeoFit's rates and announcements. Members cannot pay in the application; they renew at the front desk.
- **FR-13 Member Payment History and Receipts:** Shows a signed-in member only the payments recorded on their own member record, and gives a receipt for each payment that can be saved as a PDF file or shared.
- **FR-14 Membership Renewal Reminders:** Sends an invited member a push notification 7, 3 and 1 day before the plan expires, reminding them to renew at the front desk, and shows the same reminder on the member's Home screen.

The table below traces each functional requirement to its use case and its prototype in Section 3.2.

| FR | Function | Use Case | Prototype |
|---|---|---|---|
| FR-01 | User Authentication and Role-Based Access | UC-01 | PR-01 |
| FR-02 | Logbook Page Capture | UC-02 | PR-02 |
| FR-03 | Hybrid AI OCR Extraction | UC-03 | PR-03 |
| FR-04 | Entry Validation and Review | UC-04 | PR-04 |
| FR-05 | Offline Queue and Synchronization | UC-05 | PR-05 |
| FR-06 | Owner Revenue Monitoring | UC-06 | PR-06 |
| FR-07 | Staff Account Management | UC-07 | PR-07 |
| FR-08 | Member Management | UC-08 | PR-08 |
| FR-09 | Rates and Announcements Management | UC-09 | PR-09 |
| FR-10 | Logbook Management | UC-10 | PR-10 |
| FR-11 | Revenue Analytics and Reports | UC-11 | PR-11 |
| FR-12 | Member Sign-In and Membership Status | UC-12 | PR-12 |
| FR-13 | Member Payment History and Receipts | UC-13 | PR-13 |
| FR-14 | Membership Renewal Reminders | UC-14 | PR-14 |

*Table 2.0 Functional Requirements Traceability*


### 2.3. User Characteristics

The users of the system are identified and described as follows:

- **Staff:** Front-desk personnel who write the logbook and scan it with the mobile application. They are familiar with smartphones but are not technical users, so the scanning flow must take only a few taps.
- **Owner:** The gym owner, who uses the mobile application to monitor revenue, review uploads and manage staff accounts. The owner can also scan pages.
- **Administrator:** The person who operates the desktop application at the gym, usually the owner or a trusted staff member. The administrator manages members, rates and logbook entries and views revenue analytics.
- **Members:** NeoFit members invited by the administrator. They use the member screens of the mobile application to see their own membership, payments and receipts, the rates and the announcements, and they receive renewal reminders. Their experience with smartphones varies, so the member screens show only a few large, read-only items.

Three external systems also act on the system: the **Google Gemini API**, which reads page images; **Supabase Cloud**, which stores records, verifies users and runs the daily reminder check; and the **Expo Push Service**, which delivers the reminders to the members' phones.


### 2.4. Constraints

A constraint is a limitation that must be respected throughout development and operation. Hard constraints are mandatory; soft constraints are qualities the system should achieve.


#### 2.4.1. Hard Constraints

- **Human confirmation:** No extracted entry may be saved until a user has reviewed and confirmed the page.
- **No invented amounts:** When a digit cannot be read, the amount must be left blank rather than guessed.
- **Offline capture:** Capturing, reading and confirming a page must work without an internet connection.
- **No lost pages:** A confirmed page must be kept on the phone until it is uploaded successfully.
- **Access control:** Users may only reach the functions and records of their role, enforced by the database as well as the application. A member may see only their own membership and payments.
- **Invited members only:** Only members invited by the administrator can sign in to the member screens, and only the records of invited members are copied to the cloud database.
- **No online payment:** The system records the payments made at the front desk but does not accept payments; members pay and renew only at the front desk.
- **Data privacy:** The handling of member names and payments must comply with the Data Privacy Act of 2012 (Republic Act No. 10173).
- **Platforms:** The mobile application must run on Android, including its member screens; the desktop application must run on Windows.
- **AI quota:** Online AI scans are limited to five per day, reset at 8:00 AM, to stay within the Gemini API quota.


#### 2.4.2. Soft Constraints

- **Ease of use:** The interface should be simple enough for front-desk staff to use during busy hours without training beyond a short orientation.
- **Fast response:** The system should return results within the times given in Section 3.3.1.
- **Low resource use:** The mobile application should keep images small and the offline queue compact.
- **Accuracy:** The OCR engine should read most entries of a legible page correctly, so that the staff correct only a few rows.
- **Simple member screens:** The member screens should show only a few large, read-only items, so that members of any age can use them.
- **Maintainability:** The system should allow rates, features and fixes to be updated without reinstalling it from scratch.


### 2.5. Assumptions and Dependencies

The following assumptions and dependencies apply to the requirements in this document:

- **Logbook practice:** NeoFit continues to record member visits and payments in its paper logbook, with each line holding a name and an amount (“name – amount”).
- **Legibility:** Entries are handwritten legibly enough for a person to read them.
- **Devices:** The staff and the owner have Android smartphones with a working camera, and the gym has a Windows computer for the desktop application. Members who use the member screens have an Android phone.
- **Member contact:** Every member gives the front desk an email address that they can open on their phone.
- **Connectivity:** Internet access at the gym is available most of the time; online reading, synchronization and logbook editing on the desktop depend on it.
- **Third-party services:** The Google Gemini API, Supabase and the Expo Push Service remain available under their current free tiers and terms of use.
- **Accounts:** Staff and owner accounts are created by the owner in the cloud authentication service, and the owner keeps them up to date. Member accounts are created only through invites from the desktop application.
- **Correct rates:** The administrator keeps the rate table in the desktop application up to date, and the mobile rate check uses the same official rates.


## 3. Specific Requirements

This section specifies the requirements that the design must satisfy and that testing must verify: the external interfaces, the functional requirements as use cases and prototypes, the performance requirements, the design constraints and the software system attributes.


### 3.1. External Interfaces Requirements

This subsection specifies the hardware and software with which the system and its components must interface.


#### 3.1.1. Hardware Interfaces

The system runs on the staff's and owner's Android phones and on the gym's Windows computer. The table below lists the minimum hardware.

| Device | Minimum Requirement | Used By |
|---|---|---|
| Android smartphone | Android 7.0 (API level 24) or later<br>Rear camera with autofocus (staff and owner)<br>3 GB RAM; 1 GB free storage<br>Wi-Fi or mobile data | Staff, Owner, Members |
| Windows computer | Windows 10 or later, 64-bit<br>Dual-core 2.0 GHz processor; 4 GB RAM<br>500 MB free storage<br>1366 × 768 display | Administrator |
| Network | Internet access through Wi-Fi or mobile data for online reading, synchronization, the member screens and updates | All users |

*Table 3.0 Minimum Hardware Requirements*


#### 3.1.2. Software Interfaces

The system is built from the software components and services listed below.

| Interface | Technology | Purpose |
|---|---|---|
| Mobile application | React Native (Expo), TypeScript | Application for the staff, the owner and members |
| Online OCR service | Google Gemini API (Gemini 2.5 Flash) over HTTPS | Reads page images and returns entries as JSON |
| Offline OCR library | Google ML Kit Text Recognition | Reads page images on the phone |
| Cloud database and authentication | Supabase: PostgreSQL, Auth and Row-Level Security over HTTPS | Stores profiles, uploads, entries and the copies of member records; signs users in with passwords and with one-time email codes |
| Cloud functions | Supabase Edge Functions, run daily by a schedule (pg_cron) | Send member invites and the daily renewal reminders |
| Push notifications | Expo Notifications and the Expo Push Service | Deliver renewal reminders to the members' phones |
| Receipt export | Expo Print and Expo Sharing | Save a receipt as a PDF file and share it |
| Mobile local storage | AsyncStorage and Secure Store | Holds the offline queue and the session |
| Desktop application | Electron, React, Vite | Application for the administrator |
| Local desktop API | Express (Node.js), reachable only from the same computer | Serves data to the desktop interface |
| Local desktop database | SQLite | Stores members, payments, rates and settings |
| Report export | Word (.docx) document library | Produces the revenue report |
| Updates | GitHub Releases for the desktop; Expo EAS for the mobile application | Delivers new versions to the users |

*Table 4.0 Software Interfaces*


### 3.2. Functional Requirements

The functional requirements FR-01 to FR-14 are specified as fourteen use cases. Each use case has a diagram and a description of its actors, preconditions, main flow, alternative flows and postconditions. Section 3.2.2 presents the prototype screens that realize each use case.


#### 3.2.1. Use Case


##### 3.2.1.1. (UC-01) User Authentication and Role-Based Access Use Case

Lets each user sign in and see only the features that belong to their role: staff, owner or administrator. This use case realizes FR-01.

![Figure 2.0 User Authentication and Role-Based Access Use Case](assets/srs/UC-01.png)

*Figure 2.0 User Authentication and Role-Based Access Use Case*

| Item | Details |
|---|---|
| Use Case ID | UC-01 |
| Use Case Name | User Authentication and Role-Based Access |
| Actors | Staff, Owner, Administrator, Supabase Cloud |
| Description | Lets each user sign in and see only the features that belong to their role: staff, owner or administrator. |
| Preconditions | The user has an account. Staff and owner accounts are created in the cloud authentication service; the desktop application has one administrator account. |
| Main Flow | 1. The user opens the desktop application, or opens the mobile application and taps “Staff and owner sign in”.<br>2. The user enters an email address and password.<br>3. The system verifies the credentials.<br>4. The system loads the user's profile and role.<br>5. The system opens the staff screens (Scan, History), the owner screens (Dashboard, Scan, History, Staff, Settings), or the desktop dashboard. |
| Alternative Flows | 2a. The user is a gym member: the user signs in on the Member Sign In screen and continues with UC-12.<br>3a. The credentials are wrong: the system shows an error and stays on the sign-in screen.<br>4a. The staff account is disabled: the system refuses access and signs the user out. |
| Postconditions | The user is signed in, and the session is kept on the device until the user signs out. |

*Table 5.0 UC-01 User Authentication and Role-Based Access Description*


##### 3.2.1.2. (UC-02) Logbook Page Capture Use Case

Lets the staff or the owner photograph a logbook page, or import a photo of it, and assign the page to a date. This use case realizes FR-02.

![Figure 3.0 Logbook Page Capture Use Case](assets/srs/UC-02.png)

*Figure 3.0 Logbook Page Capture Use Case*

| Item | Details |
|---|---|
| Use Case ID | UC-02 |
| Use Case Name | Logbook Page Capture |
| Actors | Staff, Owner |
| Description | Lets the staff or the owner photograph a logbook page, or import a photo of it, and assign the page to a date. |
| Preconditions | The user is signed in and has allowed camera or gallery access. |
| Main Flow | 1. The user opens the Scan screen.<br>2. The system shows the camera view with a frame guide and the number of AI scans left for the day.<br>3. The user keeps today's date or selects an earlier date.<br>4. The user aligns the page in the frame and captures it, or imports a photo from the gallery.<br>5. The system passes the image to the OCR engine (UC-03). |
| Alternative Flows | 2a. No AI scans are left for the day: the system tells the user when the count resets and blocks the capture.<br>3a. The user tries to select a future date: the system does not allow it. |
| Postconditions | A page image and its log date are ready for extraction. |

*Table 6.0 UC-02 Logbook Page Capture Description*


##### 3.2.1.3. (UC-03) Hybrid AI OCR Extraction Use Case

Reads the member names and payment amounts from the page image, online with Google Gemini 2.5 Flash or offline with Google ML Kit. This use case realizes FR-03.

![Figure 4.0 Hybrid AI OCR Extraction Use Case](assets/srs/UC-03.png)

*Figure 4.0 Hybrid AI OCR Extraction Use Case*

| Item | Details |
|---|---|
| Use Case ID | UC-03 |
| Use Case Name | Hybrid AI OCR Extraction |
| Actors | Staff, Owner, Google Gemini API |
| Description | Reads the member names and payment amounts from the page image, online with Google Gemini 2.5 Flash or offline with Google ML Kit. |
| Preconditions | A page image has been captured or imported (UC-02). |
| Main Flow | 1. The system resizes the image for reading.<br>2. The system sends the image to the Google Gemini API with instructions for NeoFit's logbook format.<br>3. The Gemini API returns the entries as structured data: original text, name and amount.<br>4. The system counts the scan against the daily limit.<br>5. The system shows the entries on the review screen (UC-04), labeled with the engine used. |
| Alternative Flows | 2a. There is no internet connection or the API fails: the system reads the page on the device with Google ML Kit, cleans up the text, and shows a warning that the results may be less accurate.<br>3a. A digit cannot be read clearly: the amount is left blank instead of guessed. |
| Postconditions | A list of extracted entries is ready for review. |

*Table 7.0 UC-03 Hybrid AI OCR Extraction Description*


##### 3.2.1.4. (UC-04) Entry Validation and Review Use Case

Lets the user check the extracted entries, correct them, and confirm the page before it is saved. This use case realizes FR-04.

![Figure 5.0 Entry Validation and Review Use Case](assets/srs/UC-04.png)

*Figure 5.0 Entry Validation and Review Use Case*

| Item | Details |
|---|---|
| Use Case ID | UC-04 |
| Use Case Name | Entry Validation and Review |
| Actors | Staff, Owner |
| Description | Lets the user check the extracted entries, correct them, and confirm the page before it is saved. |
| Preconditions | Entries have been extracted from a page (UC-03). |
| Main Flow | 1. The system lists the entries as editable rows with the log date and the running total.<br>2. The system flags any amount that is not an official NeoFit rate, and repeated lines found by the offline reader.<br>3. The user compares the rows with the page and edits, deletes or adds entries.<br>4. The user taps Confirm and Save.<br>5. The system asks for confirmation with the number of entries and the total, then saves the page (UC-05). |
| Alternative Flows | 4a. No entry has a name: the system asks the user to add at least one entry. |
| Postconditions | The confirmed entries and their total are saved for the log date. |

*Table 8.0 UC-04 Entry Validation and Review Description*


##### 3.2.1.5. (UC-05) Offline Queue and Synchronization Use Case

Saves confirmed pages to the cloud database, or keeps them on the phone until they can be uploaded. This use case realizes FR-05.

![Figure 6.0 Offline Queue and Synchronization Use Case](assets/srs/UC-05.png)

*Figure 6.0 Offline Queue and Synchronization Use Case*

| Item | Details |
|---|---|
| Use Case ID | UC-05 |
| Use Case Name | Offline Queue and Synchronization |
| Actors | Staff, Owner, Supabase Cloud |
| Description | Saves confirmed pages to the cloud database, or keeps them on the phone until they can be uploaded. |
| Preconditions | The user has confirmed a page (UC-04). |
| Main Flow | 1. The system checks the internet connection.<br>2. The system writes the upload and its entries to the cloud database.<br>3. The system shows the success screen with the date, number of entries and total.<br>4. The upload appears in the user's history as synced. |
| Alternative Flows | 2a. The phone is offline or the upload fails: the system stores the page in the local queue, and the history shows it as pending.<br>2b. The app later synchronizes (on launch, after a save, or when the user refreshes the history): the system uploads the queued pages and removes them from the queue. |
| Postconditions | The page is stored in the cloud database, or safely queued on the phone. |

*Table 9.0 UC-05 Offline Queue and Synchronization Description*


##### 3.2.1.6. (UC-06) Owner Revenue Monitoring Use Case

Lets the owner follow the gym's revenue from the logbook scans on the phone. This use case realizes FR-06.

![Figure 7.0 Owner Revenue Monitoring Use Case](assets/srs/UC-06.png)

*Figure 7.0 Owner Revenue Monitoring Use Case*

| Item | Details |
|---|---|
| Use Case ID | UC-06 |
| Use Case Name | Owner Revenue Monitoring |
| Actors | Owner, Supabase Cloud |
| Description | Lets the owner follow the gym's revenue from the logbook scans on the phone. |
| Preconditions | The owner is signed in. |
| Main Flow | 1. The owner opens the Dashboard.<br>2. The system shows the revenue for today, this week, this month and this year, a seven-day chart, and today's summary.<br>3. The owner opens History to see every upload with the staff member who scanned it.<br>4. The owner taps an upload to see its entries.<br>5. The owner exports the upload records as a CSV file from Settings. |
| Alternative Flows | 2a. There are no uploads yet: the system shows zero totals and an empty history. |
| Postconditions | The owner has viewed or exported the revenue records. |

*Table 10.0 UC-06 Owner Revenue Monitoring Description*


##### 3.2.1.7. (UC-07) Staff Account Management Use Case

Lets the owner control which staff accounts may use the system. This use case realizes FR-07.

![Figure 8.0 Staff Account Management Use Case](assets/srs/UC-07.png)

*Figure 8.0 Staff Account Management Use Case*

| Item | Details |
|---|---|
| Use Case ID | UC-07 |
| Use Case Name | Staff Account Management |
| Actors | Owner, Supabase Cloud |
| Description | Lets the owner control which staff accounts may use the system. |
| Preconditions | The owner is signed in, and staff accounts exist. |
| Main Flow | 1. The owner opens the Staff screen.<br>2. The system lists the staff accounts with the number of active and disabled accounts.<br>3. The owner taps the disable button of a staff account and confirms.<br>4. The system marks the account as disabled. |
| Alternative Flows | 3a. The account is already disabled: the owner re-enables it instead. |
| Postconditions | A disabled account can no longer sign in; a re-enabled account can. |

*Table 11.0 UC-07 Staff Account Management Description*


##### 3.2.1.8. (UC-08) Member Management Use Case

Lets the administrator keep NeoFit's member records and payments on the desktop application, and invite members to the member screens of the mobile application. This use case realizes FR-08.

![Figure 9.0 Member Management Use Case](assets/srs/UC-08.png)

*Figure 9.0 Member Management Use Case*

| Item | Details |
|---|---|
| Use Case ID | UC-08 |
| Use Case Name | Member Management |
| Actors | Administrator, Supabase Cloud |
| Description | Lets the administrator keep NeoFit's member records and payments on the desktop application, and invite members to the member screens of the mobile application. |
| Preconditions | The administrator is signed in to the desktop application. |
| Main Flow | 1. The administrator opens the dashboard, which shows member counts, today's logbook entries, revenue, and expired or expiring plans.<br>2. The administrator opens Members and searches by name or ID, or filters by status.<br>3. The administrator adds a member with a name, email address, plan, join date and, optionally, a contact number and a photo, or edits an existing member.<br>4. The system assigns a member ID, records the payment with a receipt number, and computes the status (Active, Expiring Soon, Expired or Pending).<br>5. The administrator renews a membership; the system records the new payment and starts the new period after the current one ends so paid days are kept.<br>6. The administrator opens a member's details and taps Send Invite; the system emails the member a one-time code for signing in to the member screens. |
| Alternative Flows | 3a. Required fields are missing: the system does not save and highlights them.<br>3b. Another member already uses the email address: the system does not save and asks for a different address.<br>5a. The administrator deletes a member: the system asks for confirmation first, and also removes the member's access to the member screens.<br>6a. The computer is offline: the system shows a notice, and the administrator sends the invite when the connection returns. |
| Postconditions | The member records and payments are up to date, and invited members can sign in to the member screens. |

*Table 12.0 UC-08 Member Management Description*


##### 3.2.1.9. (UC-09) Rates and Announcements Management Use Case

Lets the administrator maintain NeoFit's official price matrix and the announcements that members see. This use case realizes FR-09.

![Figure 10.0 Rates and Announcements Management Use Case](assets/srs/UC-09.png)

*Figure 10.0 Rates and Announcements Management Use Case*

| Item | Details |
|---|---|
| Use Case ID | UC-09 |
| Use Case Name | Rates and Announcements Management |
| Actors | Administrator, Supabase Cloud |
| Description | Lets the administrator maintain NeoFit's official price matrix and the announcements that members see. |
| Preconditions | The administrator is signed in to the desktop application. |
| Main Flow | 1. The administrator opens Rates.<br>2. The system shows the monthly, semi-monthly and daily rates of each plan, and the current announcements for members.<br>3. The administrator edits the rates and taps Save Rates.<br>4. The system stores the rates, uses them for revenue and member payments, and publishes them to the member screens.<br>5. The administrator posts an announcement with a title and a message, or removes an old one; the system updates the announcements that members see. |
| Alternative Flows | 3a. The administrator taps Reset Default: the system restores the official default rates for review before saving.<br>4a. The computer is offline: the system saves the rates locally and publishes them when the connection returns.<br>5a. The computer is offline: the system shows a notice and disables posting and removing announcements. |
| Postconditions | The new rates apply to all revenue computations, and members see the current rates and announcements. |

*Table 13.0 UC-09 Rates and Announcements Management Description*


##### 3.2.1.10. (UC-10) Logbook Management Use Case

Lets the administrator review and correct the logbook entries synchronized from the phones. This use case realizes FR-10.

![Figure 11.0 Logbook Management Use Case](assets/srs/UC-10.png)

*Figure 11.0 Logbook Management Use Case*

| Item | Details |
|---|---|
| Use Case ID | UC-10 |
| Use Case Name | Logbook Management |
| Actors | Administrator, Supabase Cloud |
| Description | Lets the administrator review and correct the logbook entries synchronized from the phones. |
| Preconditions | The administrator is signed in, and the desktop computer is online. |
| Main Flow | 1. The administrator opens Logbook.<br>2. The system shows a calendar that marks the days with entries and their totals.<br>3. The administrator selects a date.<br>4. The system lists the entries with their name, amount, source (scan or manual) and time.<br>5. The administrator adds, edits or deletes entries, and the system updates the cloud database. |
| Alternative Flows | 1a. The computer is offline: the system shows a notice and disables adding and editing.<br>5a. The administrator deletes all entries for a date: the system asks for confirmation first. |
| Postconditions | The logbook entries in the cloud database are corrected. |

*Table 14.0 UC-10 Logbook Management Description*


##### 3.2.1.11. (UC-11) Revenue Analytics and Reports Use Case

Gives the administrator NeoFit's revenue from the logbook scans and member payments, with charts, breakdowns and a downloadable report. This use case realizes FR-11.

![Figure 12.0 Revenue Analytics and Reports Use Case](assets/srs/UC-11.png)

*Figure 12.0 Revenue Analytics and Reports Use Case*

| Item | Details |
|---|---|
| Use Case ID | UC-11 |
| Use Case Name | Revenue Analytics and Reports |
| Actors | Administrator, Supabase Cloud |
| Description | Gives the administrator NeoFit's revenue from the logbook scans and member payments, with charts, breakdowns and a downloadable report. |
| Preconditions | The administrator is signed in to the desktop application. |
| Main Flow | 1. The administrator opens Revenue.<br>2. The system combines the logbook scans and the member payments recorded on the desktop, counting a payment only once when the same name appears in both on the same day.<br>3. The system shows the month's total and growth, a daily chart with the peak day, the year's total, and breakdowns by source and plan.<br>4. The administrator filters the chart by source or opens the breakdown of a day.<br>5. The administrator downloads the revenue report as a Word document. |
| Alternative Flows | 2a. The cloud database cannot be reached: the system shows the revenue from the desktop's local records, and adds the logbook scans once the cloud database is reachable again. |
| Postconditions | The administrator has viewed or downloaded the revenue report. |

*Table 15.0 UC-11 Revenue Analytics and Reports Description*


##### 3.2.1.12. (UC-12) Member Sign-In and Membership Status Use Case

Lets an invited member sign in to the mobile application with an email address and password, and see their own membership, NeoFit's rates and the gym's announcements. This use case realizes FR-12.

![Figure 13.0 Member Sign-In and Membership Status Use Case](assets/srs/UC-12.png)

*Figure 13.0 Member Sign-In and Membership Status Use Case*

| Item | Details |
|---|---|
| Use Case ID | UC-12 |
| Use Case Name | Member Sign-In and Membership Status |
| Actors | Member, Supabase Cloud |
| Description | Lets an invited member sign in to the mobile application with an email address and password, and see their own membership, NeoFit's rates and the gym's announcements. |
| Preconditions | The administrator has invited the member (UC-08). |
| Main Flow | 1. The member opens the mobile application, which shows the Member Sign In screen.<br>2. The member enters the email address given to the front desk and the password, and taps Sign In.<br>3. The system verifies them and loads the member's own record.<br>4. The system shows the member's Home screen: the plan, the expiry date, the days left, the status, the last payment and the latest announcement.<br>5. The member opens Rates to see the official rates and all current announcements. |
| Alternative Flows | 2a. The member signs in for the first time or has forgotten the password: the member taps “Get an email code”, enters the email address and taps Send Code; the system emails a one-time code; the member types the code, creates a password of at least 8 characters, and continues with step 4.<br>2b. The member already holds the code from the invite: the member taps “I already have a code” and types it.<br>2c. The email address has not been invited: the system sends no code, and the screen does not say whether an address is invited.<br>2d. The code is wrong or has expired: the system shows an error and the member asks for a new code.<br>3a. The email address or the password is wrong: the system shows one message for both and stays on the sign-in screen.<br>4a. The plan expires within seven days or has expired: the Home screen shows the status and asks the member to renew at the front desk.<br>4b. The member opens Account to change the password: the system saves the new password only after it has verified the current one. |
| Postconditions | The member is signed in and sees only their own membership. The session stays on the device until the member signs out. |

*Table 16.0 UC-12 Member Sign-In and Membership Status Description*


##### 3.2.1.13. (UC-13) Member Payment History and Receipts Use Case

Shows a signed-in member the payments recorded on their own member record, with a receipt for each payment. This use case realizes FR-13.

![Figure 14.0 Member Payment History and Receipts Use Case](assets/srs/UC-13.png)

*Figure 14.0 Member Payment History and Receipts Use Case*

| Item | Details |
|---|---|
| Use Case ID | UC-13 |
| Use Case Name | Member Payment History and Receipts |
| Actors | Member, Supabase Cloud |
| Description | Shows a signed-in member the payments recorded on their own member record, with a receipt for each payment. |
| Preconditions | The member is signed in (UC-12). |
| Main Flow | 1. The member opens Payments.<br>2. The system shows the total and the number of payments this year, and lists the member's payments, newest first, with the date, the period covered, the receipt number and the amount.<br>3. The member taps a payment.<br>4. The system shows its receipt: the receipt number, the date, the member, the plan, the period covered, the amount and the place of payment.<br>5. The member saves the receipt as a PDF file or shares it. |
| Alternative Flows | 2a. No payment is recorded on the member's record yet: the system shows an empty list.<br>2b. The phone is offline: the system shows a notice and asks the member to try again when connected. |
| Postconditions | The member has viewed, saved or shared a receipt. Payments of other members and the logbook lines are never shown. |

*Table 17.0 UC-13 Member Payment History and Receipts Description*


##### 3.2.1.14. (UC-14) Membership Renewal Reminders Use Case

Reminds invited members to renew at the front desk before their plans expire. This use case realizes FR-14.

![Figure 15.0 Membership Renewal Reminders Use Case](assets/srs/UC-14.png)

*Figure 15.0 Membership Renewal Reminders Use Case*

| Item | Details |
|---|---|
| Use Case ID | UC-14 |
| Use Case Name | Membership Renewal Reminders |
| Actors | Member, Supabase Cloud, Expo Push Service |
| Description | Reminds invited members to renew at the front desk before their plans expire. |
| Preconditions | The member has signed in to the Android application (UC-12), and the plan has an expiry date. |
| Main Flow | 1. After the member signs in, the system asks for permission to show notifications, and the member allows it.<br>2. The system registers the phone for push notifications on the member's record.<br>3. Every day at 8:00 AM, the system finds the invited members whose plans expire in exactly 7, 3 or 1 days.<br>4. The system sends each of them a push notification with the expiry date and a reminder to renew at the front desk.<br>5. The member taps the notification, and the system opens the member's Home screen. |
| Alternative Flows | 1a. The member does not allow notifications: no push notification is sent, and the Home screen shows the same reminder while the plan expires within seven days.<br>3a. The member has already renewed: the new expiry date is used, so no reminder is sent for the old one.<br>4a. A reminder was already sent to the member today: the system does not send it again. |
| Postconditions | The member knows when the plan expires and can renew at the front desk on time. |

*Table 18.0 UC-14 Membership Renewal Reminders Description*


#### 3.2.2. Prototype

The prototype screens below are the interface designs of the system, shown with sample data. Phone screens belong to the mobile application; wide screens belong to the desktop application.


##### 3.2.2.1. (PR-01) User Authentication and Role-Based Access Prototype

The staff and owner sign-in screen, with the way back to the member sign-in, and the owner's Settings screen, where the password and profile are changed.

![Figure 16.0 User Authentication and Role-Based Access Prototype](assets/srs/PR-01.png)

*Figure 16.0 User Authentication and Role-Based Access Prototype*


##### 3.2.2.2. (PR-02) Logbook Page Capture Prototype

The capture screen with the frame guide, the log date selector and the daily AI scan counter.

![Figure 17.0 Logbook Page Capture Prototype](assets/srs/PR-02.png)

*Figure 17.0 Logbook Page Capture Prototype*


##### 3.2.2.3. (PR-03) Hybrid AI OCR Extraction Prototype

The processing screen, and the review screen after an offline read by ML Kit, with a warning and duplicate flags.

![Figure 18.0 Hybrid AI OCR Extraction Prototype](assets/srs/PR-03.png)

*Figure 18.0 Hybrid AI OCR Extraction Prototype*


##### 3.2.2.4. (PR-04) Entry Validation and Review Prototype

The review screen with a flagged amount, and the confirmation shown after the page is saved.

![Figure 19.0 Entry Validation and Review Prototype](assets/srs/PR-04.png)

*Figure 19.0 Entry Validation and Review Prototype*


##### 3.2.2.5. (PR-05) Offline Queue and Synchronization Prototype

The staff member's uploads, each marked as synced or pending.

![Figure 20.0 Offline Queue and Synchronization Prototype](assets/srs/PR-05.png)

*Figure 20.0 Offline Queue and Synchronization Prototype*


##### 3.2.2.6. (PR-06) Owner Revenue Monitoring Prototype

The owner's revenue dashboard and revenue history.

![Figure 21.0 Owner Revenue Monitoring Prototype](assets/srs/PR-06.png)

*Figure 21.0 Owner Revenue Monitoring Prototype*


##### 3.2.2.7. (PR-07) Staff Account Management Prototype

The Staff screen with active and disabled staff accounts.

![Figure 22.0 Staff Account Management Prototype](assets/srs/PR-07.png)

*Figure 22.0 Staff Account Management Prototype*


##### 3.2.2.8. (PR-08) Member Management Prototype

The desktop dashboard with today's logbook entries and membership alerts, the member list, and the details of a member with the invite to the member screens.

![Figure 23.0 Member Management Prototype](assets/srs/PR-08.png)

*Figure 23.0 Member Management Prototype*

![Figure 24.0 Member Management Prototype (continued)](assets/srs/PR-08-2.png)

*Figure 24.0 Member Management Prototype (continued)*


##### 3.2.2.9. (PR-09) Rates and Announcements Management Prototype

The editable official rate table and the announcements for members.

![Figure 25.0 Rates and Announcements Management Prototype](assets/srs/PR-09.png)

*Figure 25.0 Rates and Announcements Management Prototype*


##### 3.2.2.10. (PR-10) Logbook Management Prototype

The logbook view with the calendar of days that have entries and the entries of one day.

![Figure 26.0 Logbook Management Prototype](assets/srs/PR-10.png)

*Figure 26.0 Logbook Management Prototype*


##### 3.2.2.11. (PR-11) Revenue Analytics and Reports Prototype

Revenue analytics with the monthly total, the daily chart and the breakdowns.

![Figure 27.0 Revenue Analytics and Reports Prototype](assets/srs/PR-11.png)

*Figure 27.0 Revenue Analytics and Reports Prototype*


##### 3.2.2.12. (PR-12) Member Sign-In and Membership Status Prototype

The member sign-in screen, the email code and create password screens, the member's Home screen with the membership status, the Account screen where the password is changed, and the rates and announcements.

![Figure 28.0 Member Sign-In and Membership Status Prototype](assets/srs/PR-12.png)

*Figure 28.0 Member Sign-In and Membership Status Prototype*

![Figure 29.0 Member Sign-In and Membership Status Prototype (continued)](assets/srs/PR-12-2.png)

*Figure 29.0 Member Sign-In and Membership Status Prototype (continued)*


##### 3.2.2.13. (PR-13) Member Payment History and Receipts Prototype

The member's payment history and the receipt of one payment.

![Figure 30.0 Member Payment History and Receipts Prototype](assets/srs/PR-13.png)

*Figure 30.0 Member Payment History and Receipts Prototype*


##### 3.2.2.14. (PR-14) Membership Renewal Reminders Prototype

Renewal reminders on the member's phone, received 7 and 3 days before the plan expires.

![Figure 31.0 Membership Renewal Reminders Prototype](assets/srs/PR-14.png)

*Figure 31.0 Membership Renewal Reminders Prototype*


### 3.3. Performance Requirements

These requirements describe how quickly and efficiently the system must perform its functions. They assume the minimum hardware in Table 3.0 and a normal mobile or Wi-Fi connection, and they will be verified in the Software Test Document.


#### 3.3.1. Execution Time

The system shall complete the following operations within the times given:

| Operation | Requirement |
|---|---|
| Sign in | Within 5 seconds |
| Read one page online (Gemini 2.5 Flash) | Entries shown within 30 seconds |
| Read one page offline (ML Kit) | Entries shown within 5 seconds |
| Save a confirmed page while online | Within 10 seconds |
| Synchronize a queued page after the connection returns | Within 10 seconds per page |
| Open the owner's revenue dashboard | Within 5 seconds |
| Open a desktop view (members, rates, logbook) | Within 3 seconds, with up to 1,000 members |
| Compute and display one month of revenue analytics | Within 5 seconds |
| Generate the Word revenue report | Within 10 seconds |
| Open the member's Home or Payments screen | Within 3 seconds |
| Save a receipt as a PDF file | Within 5 seconds |
| Send the daily renewal reminders | All reminders sent within 10 minutes after 8:00 AM |

*Table 19.0 Execution Time Requirements*


#### 3.3.2. Efficiency

The system shall use device, network and service resources sparingly. The mobile application shall resize each page image to a width of 1,600 pixels and compress it before reading or uploading it, and it shall store queued pages as compact records without the image. Online AI reading shall be limited to five scans per day, while the offline reader has no limit. The desktop application shall keep its data in a single local SQLite database file and shall reuse recently fetched logbook data instead of querying the cloud database on every screen. The member screens shall load only the signed-in member's records, and the reminder check shall run once a day.


### 3.4. Design Constraints


#### 3.4.1. Software Language

The mobile application shall be written in TypeScript with React Native and Expo. The desktop application shall be written in TypeScript and JavaScript with Electron, React and Vite, with a local API in Node.js and Express. Data shall be stored in PostgreSQL on Supabase, accessed through the Supabase client libraries and protected by SQL row-level security policies, and in SQLite on the desktop.


#### 3.4.2. Graphical-User Interface

The mobile interface shall use a dark theme with a high-contrast mint accent, large touch targets, and bottom tabs that depend on the role: Scan and History for the staff; Dashboard, Scan, History, Staff and Settings for the owner; and Home, Payments, Rates and Account for members. The desktop interface shall use a sidebar with Dashboard, Members, Rates, Revenue and Logbook, and shall offer light and dark modes. Amounts shall be shown in Philippine pesos and dates in the Philippine format. Screens shall be designed in Figma and kept consistent with the prototypes in Section 3.2.2.


### 3.5. Software System Attributes

The system must have the following quality attributes.


#### 3.5.1. Reliability

The system shall produce correct and consistent records. No page shall be saved without a user's confirmation, and no amount shall be invented by the OCR engine. A confirmed page shall never be lost: it stays in the offline queue until an upload succeeds. Revenue computations shall count each payment once, even when the same payment appears in both a member payment and a logbook scan, and they shall match a manual tally of the same days. Each payment recorded on the desktop shall appear once in the member's payment history with a unique receipt number, and a renewal reminder shall be sent at most once per reminder day.


#### 3.5.2. Availability

Scanning shall remain available when the internet connection or the Gemini API is down, because the offline reader and the offline queue take over. The desktop application's member and rate functions shall work without internet access, since they use the local database; logbook editing and the logbook part of revenue analytics require access to the cloud database. The member screens and the renewal reminders require an internet connection; member records changed while the desktop computer is offline shall be published when the connection returns. The system depends on the availability of Supabase, the Gemini API and the Expo Push Service under their service terms.


#### 3.5.3. Security

Every user shall sign in before using the system, and each role shall reach only its own functions. Row-level security in the cloud database shall ensure that a staff account can only create uploads under its own identity, and a disabled staff account shall not be able to sign in. All traffic between the applications and the cloud services shall be encrypted with HTTPS. The desktop application shall store passwords only as hashes, expire sessions after 24 hours, and accept API requests only from the same computer. Service keys and passwords shall be kept in configuration files outside the source code. Member accounts shall be created only by invitation from the desktop application, and sign-up without an invitation shall be disabled. A member’s password shall have at least 8 characters, and the current password shall be required to change it. An email code shall work only once and expire after one hour, a member who signs in with a code shall create a new password before reaching the member screens, and the messages of the sign-in screens shall not state whether an email address belongs to a member. No two members shall share an email address. Row-level security shall let a member read only their own membership and payments; members shall have no access to the logbook, the uploads, the staff profiles or the records of other members. Only the records of invited members shall be copied to the cloud database. Member information shall be collected and used only for the purposes of the system, in line with the Data Privacy Act of 2012.


#### 3.5.4. Maintainability

The code shall be organized into separate screens, services and data-access modules, written in TypeScript where possible, and kept in a Git repository. The rate table shall be defined in one place for revenue computations. New versions of the mobile application shall be deliverable through Expo EAS updates, and the desktop application shall update itself from GitHub Releases, so that fixes reach NeoFit without manual reinstallation.


#### 3.5.5. Portability

The mobile application shall run on Android 7.0 or later, including its member screens; because it is built with React Native and Expo, it can be built for iOS in the future without a rewrite. The desktop application shall run on Windows 10 or later. Records shall be stored in standard PostgreSQL and SQLite databases and can be exported as CSV and Word files, so the data is not locked into the application.

