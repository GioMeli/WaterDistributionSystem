# Requirements Document

## 1. Application Overview

**Application Name**: WATER DISTRIBUTION MANAGEMENT SYSTEM

**Description**: A mobile-first web application for managing water bottle deliveries, contractor/vendor operations, admin approval workflows, digital signatures, PDF waybill generation, historical records, reports, analytics, and data exports. The system supports two user roles (VENDOR and ADMIN) and must be responsive across Android phones, iPhones, tablets, and desktop browsers.

**Design Requirements**: Professional, clean, modern design suitable for logistics/UN-style operational environment. Color theme: blue, white, grey. UI elements include dashboards, cards, forms, tables, progress indicators, maps, and status badges.

## 2. Users and Usage Scenarios

**Target Users**:
- VENDOR: Contractors who perform water bottle deliveries
- ADMIN: Internal logistics users who manage locations, review deliveries, approve reports, and access analytics

**Core Usage Scenarios**:
- Vendors start deliveries, complete location-by-location delivery forms with officer signatures, and submit to Admin for review
- Admins manage locations, review vendor submissions, approve/reject deliveries with digital signatures, generate final signed PDFs, and access comprehensive reports and analytics

## 3. Page Structure and Functional Description

### 3.1 Page Structure

```
WATER DISTRIBUTION MANAGEMENT SYSTEM
├── Login Page
├── VENDOR Section
│   ├── Vendor Dashboard
│   ├── Start New Delivery Screen
│   ├── Vendor Delivery Dashboard
│   ├── Location Delivery Form
│   ├── Vendor Final Confirmation Screen
│   └── Delivery History
└── ADMIN Section
    ├── Admin Dashboard
    ├── Admin Review Delivery Screen
    ├── Admin Approval Screen
    ├── Admin Reports Page
    ├── Location Management Page
    └── Vendor Management Page
```

### 3.2 Login Page

**Fields**: Email, Password

**Actions**: Login button, Logout option

**Functionality**: Users authenticate with email and password. After successful login, VENDOR users are redirected to Vendor Dashboard, ADMIN users are redirected to Admin Dashboard. Support future password reset functionality.

### 3.3 VENDOR Section

#### 3.3.1 Vendor Dashboard

**Display Elements**:
- Start New Delivery button
- Delivery History section showing list of previous deliveries
- Each delivery item displays: Delivery Date, Status (In Progress/Submitted to Admin/Rejected/Approved/Finalised), Total locations, Completed locations, Total issued quantity, Total received quantity, PDF download button

**Functionality**:
- Start New Delivery button navigates to Start New Delivery Screen
- Delivery History displays all deliveries created by the logged-in vendor
- PDF download button is only visible and functional when delivery status is approved or finalised. If not approved, display message: \"PDF pending admin approval\"
- Status badges use color coding for visual clarity

#### 3.3.2 Start New Delivery Screen

**Fields**:
- Delivery Date (required)
- Vendor Full Name (required)

**Actions**: Start Delivery button

**Functionality**: When vendor clicks Start Delivery, create new delivery record with status in_progress, automatically create delivery item records for all active locations with status pending, redirect to Vendor Delivery Dashboard.

#### 3.3.3 Vendor Delivery Dashboard

**Display Elements**:
- Delivery Date
- Vendor Name
- Delivery Status
- Progress Summary: Total Locations, Completed Locations, Pending Locations, No Issue Needed Locations, Completion Percentage
- Progress bar
- Interactive Map showing all active delivery locations with color-coded markers (Pending=red, Completed=green, No Issue Needed=grey)
- Locations list sorted by route number

**Location List Item Display**:
- Route Number
- Office Name
- Building Number
- SUP Number
- Estimated Bottles
- Status
- Open button
- Open in Google Maps button

**Functionality**:
- Interactive map displays all delivery locations with markers
- Open button navigates to Location Delivery Form for selected location
- Open in Google Maps button opens navigation to the location's latitude and longitude
- Progress updates automatically as locations are completed
- Submit to Admin button is disabled until every location has status completed or no_issue_needed
- When all locations are completed, Submit to Admin button becomes enabled and navigates to Vendor Final Confirmation Screen

#### 3.3.4 Location Delivery Form

**Display Elements**:
- Location Details: Route Number, Building Number, Office Name, SUP Number, Estimated Bottles

**Form Fields**:
- Issued Quantity (number, required unless No Issue Needed)
- Received Quantity (number, required unless No Issue Needed)
- Officer Name (text, required unless No Issue Needed)
- Officer Signature (signature pad using free draw, required unless No Issue Needed)
- Notes (optional)
- No Issue Needed (checkbox)

**Actions**: Save Location button, Back to Dashboard button

**Functionality**:
- If \"No Issue Needed\" is checked: Issued Quantity=0, Received Quantity=0, Officer Name=\"No Issue Required\", Officer Signature not required, Status=no_issue_needed
- If \"No Issue Needed\" is not checked: all fields are required, Status=completed
- Save Location button saves the delivery item, updates status, updates progress summary, updates map marker color, returns to Vendor Delivery Dashboard
- Back to Dashboard button returns without saving

#### 3.3.5 Vendor Final Confirmation Screen

**Fields**:
- Vendor Full Name (required)
- Vendor Signature (signature pad using free draw, required)

**Actions**: Submit to Admin button

**Functionality**: When vendor clicks Submit to Admin, save vendor full name and vendor signature, change delivery status to submitted_to_admin, notify Admin, vendor cannot edit delivery unless Admin rejects it.

#### 3.3.6 Delivery History

**Display Elements**: List of all deliveries created by the logged-in vendor

**Each Delivery Item Shows**:
- Delivery Date
- Status
- Total locations
- Completed locations
- Total issued quantity
- Total received quantity
- PDF download button (only visible when status is approved or finalised)

**Functionality**: Vendor can view historical deliveries and download final PDFs only after Admin has signed and approved the report.

### 3.4 ADMIN Section

#### 3.4.1 Admin Dashboard

**Summary Cards**:
- Total Deliveries
- Pending Admin Review
- Approved Deliveries
- Rejected Deliveries
- Total Bottles Issued
- Total Bottles Received
- No Issue Needed Count
- Current Month Consumption
- Current Year Consumption

**Sections**:
1. Pending Review: List of deliveries with status submitted_to_admin
2. Recent Deliveries: List of recent deliveries across all statuses
3. Reports: Link to Admin Reports Page
4. Locations Management: Link to Location Management Page
5. Vendor Management: Link to Vendor Management Page

**Functionality**: Admin can navigate to different sections, view summary statistics, and access pending deliveries for review.

#### 3.4.2 Admin Review Delivery Screen

**Display Elements**:
- Delivery Header: Delivery Date, Vendor Name, Submitted Date, Delivery Status, Total Issued, Total Received, Number of completed locations, Number of no issue locations
- Table of all delivery locations with columns: Route Number, Building Number, Office Name, SUP Number, Estimated Bottles, Issued Quantity, Received Quantity, Officer Name, Status, Officer Signature, Notes

**Actions**:
- Approve button
- Reject button
- Add Admin Comments field (optional)

**Functionality**:
- Admin reviews all delivery location details and officer signatures
- If Reject: Admin must enter rejection reason in Admin Comments, change status to rejected_by_admin, vendor can edit and resubmit
- If Approve: Navigate to Admin Approval Screen

#### 3.4.3 Admin Approval Screen

**Fields**:
- Admin Full Name (required)
- Admin Signature (signature pad using free draw, required)
- Admin Comments (optional)

**Actions**: Approve and Generate Final PDF button

**Functionality**: When Admin clicks Approve and Generate Final PDF, save admin full name, save admin signature, change delivery status to approved/finalised, generate final PDF titled \"WATER BOTTLES DELIVERY WAYBILL\", save final PDF, make PDF visible to vendor, send email notification if configured.

#### 3.4.4 Admin Reports Page

**Filters**:
- Start Date
- End Date
- Year
- Month
- Vendor
- Location
- Building Number
- Office Name
- SUP Number
- Status
- No Issue Needed only
- Minimum issued quantity
- Maximum issued quantity

**Report Cards**:
- Total Issued Quantity
- Total Received Quantity
- Total Difference
- Number of Deliveries
- Number of Locations Served
- Number of No Issue Needed entries
- Average Issued Quantity per Delivery
- Average Received Quantity per Delivery
- Highest Consumption Location
- Lowest Consumption Location
- Most Frequent No Issue Needed Location

**Charts**:
1. Consumption by Month
2. Consumption by Location
3. Consumption by Building
4. Consumption by Vendor
5. Issued vs Received Quantity
6. No Issue Needed by Location
7. Yearly Consumption Trend

**Tables**:
1. Detailed Delivery Records
2. Consumption by Location Summary
3. Consumption by Building Summary
4. Monthly Consumption Summary
5. Vendor Performance Summary (operational delivery data only, no employee performance scoring)
6. No Issue Needed Summary

**Export Actions**:
- Export CSV button
- Export Excel button
- Download PDF Report button

**Functionality**: Admin applies filters to view specific data, views summary cards and charts, views detailed tables, exports filtered data to CSV/Excel/PDF.

#### 3.4.5 Location Management Page

**Display Elements**: Table of all locations with columns: Route Number, Building Number, Office Name, SUP Number, Estimated Bottles, Latitude, Longitude, Notes, Active/Inactive status

**Actions**:
- Add Location button
- Edit Location button (per location)
- Deactivate Location button (per location)
- Reorder Locations functionality
- Import Locations from CSV button
- Export Locations to CSV button

**Functionality**:
- Admin can create new locations with all required fields
- Admin can edit existing locations
- Admin can deactivate locations (inactive locations do not appear in new deliveries but remain visible in historical reports)
- Admin can reorder locations
- Admin can import locations from CSV file
- Admin can export locations to CSV file

#### 3.4.6 Vendor Management Page

**Display Elements**: Table of all vendors with columns: Vendor Full Name, Email, Status, Created Date

**Actions**:
- Add Vendor button
- Deactivate Vendor button (per vendor)
- View Vendor Delivery History button (per vendor)

**Functionality**:
- Admin can create new vendor users
- Admin can deactivate vendor users
- Admin can view delivery history for each vendor

### 3.5 Email Functionality

**Trigger**: After Admin approval on Admin Approval Screen

**Option**: Send Final Report by Email button

**Email Details**:
- Subject: Water Bottles Delivery Waybill - {Delivery Date} - {Vendor Name}
- Body: Please find attached the final approved Water Bottles Delivery Waybill.
- Attachment: Final signed PDF
- Recipient: Admin can configure recipient email address

**Email Service**: Use Resend API Key: re_acuamtqp_DEHJUvr3F3NBjjAMHgdF33kr

## 4. Business Rules and Logic

### 4.1 User Roles and Permissions

**VENDOR Permissions**:
- Start new delivery
- Select delivery date
- View assigned route and locations
- View map with all delivery locations
- Open navigation to each location
- Complete delivery form for each location
- Enter issued quantity, received quantity, officer name
- Capture officer signature using free draw signature pad
- Select \"No Issue Needed\"
- Save each completed location
- Generate draft delivery waybill after all locations are completed
- Add vendor full name and vendor signature
- Submit delivery to Admin for review
- View delivery history
- View completed PDFs only after Admin has reviewed, signed, and approved the report

**VENDOR Restrictions**:
- Cannot edit system locations
- Cannot edit completed approved deliveries
- Cannot delete data
- Cannot access admin reports
- Cannot access other vendors' data
- Cannot approve reports

**ADMIN Permissions**:
- View all deliveries
- View all vendors
- View all locations
- Create, edit, activate, deactivate, and reorder locations
- View pending vendor submissions
- Review submitted delivery details and officer signatures
- Add admin comments
- Approve delivery
- Reject delivery and send back for correction
- Add Admin Full Name and capture Admin Signature
- Finalise and lock delivery report
- Generate final signed PDF
- Send final PDF by email
- Make final PDF visible in vendor history
- View reports and analytics
- Filter reports by date range, year, month, vendor, location, building, SUP number, route number, and status
- Export data to CSV and Excel
- Download PDFs
- Manage application settings

### 4.2 Delivery Status Flow

**Status Progression**: draft → in_progress → submitted_to_admin → rejected_by_admin → resubmitted_to_admin → approved → finalised

**Status Definitions**:
- draft: Delivery created but not started
- in_progress: Vendor is completing location deliveries
- submitted_to_admin: Vendor has submitted delivery for admin review
- rejected_by_admin: Admin has rejected delivery, vendor can edit and resubmit
- resubmitted_to_admin: Vendor has resubmitted after rejection
- approved: Admin has approved delivery
- finalised: Final PDF generated and locked

### 4.3 Location Item Status

**Status Values**: pending, completed, no_issue_needed

**Status Definitions**:
- pending: Location delivery not yet completed
- completed: Location delivery completed with all required fields
- no_issue_needed: Location marked as \"No Issue Needed\"

### 4.4 Delivery Completion Rule

Vendor can only submit delivery to Admin when every location has status completed or no_issue_needed. Submit to Admin button is disabled until this condition is met.

### 4.5 No Issue Needed Logic

When vendor checks \"No Issue Needed\" for a location:
- Issued Quantity = 0
- Received Quantity = 0
- Officer Name = \"No Issue Required\"
- Officer Signature not required
- Status = no_issue_needed

### 4.6 PDF Visibility Rule

Vendor can only download final PDF when delivery status is approved or finalised. If delivery is not yet approved, display message: \"PDF pending admin approval\".

### 4.7 Location Active/Inactive Rule

Inactive locations do not appear in new deliveries but remain visible in historical reports.

### 4.8 Rejection and Resubmission

When Admin rejects a delivery:
- Admin must enter rejection reason in Admin Comments
- Delivery status changes to rejected_by_admin
- Vendor can edit delivery and resubmit
- Upon resubmission, status changes to resubmitted_to_admin

### 4.9 PDF Generation Requirements

**PDF Title**: WATER BOTTLES DELIVERY WAYBILL

**PDF Content**:
- Header: WATER BOTTLES DELIVERY WAYBILL, Delivery Date, Vendor Name, Report Status (Finalised/Approved), Generated Date, Report ID
- Summary section: Total Locations, Completed Locations, No Issue Needed Locations, Total Issued Quantity, Total Received Quantity
- Main table columns: Route No, Building Number, Office Name, SUP Number, Estimated Bottles, Issued Quantity, Received Quantity, Officer Name, Status, Notes
- Include every location even if No Issue Needed was selected
- Officer signature in main table if space allows, or in separate signature appendix section
- Signature Appendix: For each location: Route Number, Office Name, Officer Name, Officer Signature image
- Final signature section: Vendor Full Name, Vendor Signature, Admin Full Name, Admin Signature, Delivery Date, Approved Date

**PDF Filename Format**: Water_Bottles_Delivery_Waybill_YYYY-MM-DD_VENDORNAME.pdf

### 4.10 Export Data Columns

**CSV and Excel Export Columns**: Delivery Date, Vendor Name, Route Number, Building Number, Office Name, SUP Number, Estimated Bottles, Issued Quantity, Received Quantity, Difference, Officer Name, Status, No Issue Needed, Notes, Approved By, Approved Date

**Excel Export Sheets**:
- Sheet 1: Detailed Data
- Sheet 2: Summary by Location
- Sheet 3: Summary by Building
- Sheet 4: Monthly Summary
- Sheet 5: No Issue Needed Summary

### 4.11 Audit Trail

**Tracked Actions**: Delivery created, Location completed, Location edited, Delivery submitted, Delivery rejected, Delivery approved, PDF generated, PDF emailed, Report exported

**Audit Log Fields**: user_id, action, entity_type, entity_id, timestamp, details

## 5. Database Structure

### 5.1 USERS Table

**Fields**: id, full_name, email, password_hash, role (vendor/admin), status (active/inactive), created_at, updated_at

### 5.2 LOCATIONS Table

**Fields**: id, route_number, building_number, office_name, sup_number, estimated_bottles, latitude, longitude, location_notes, is_active, created_at, updated_at

**Note**: Locations must be editable by Admin without changing code.

### 5.3 DELIVERIES Table

**Fields**: id, delivery_date, vendor_id, vendor_full_name, vendor_signature_url, admin_id, admin_full_name, admin_signature_url, status (draft/in_progress/submitted_to_admin/rejected_by_admin/approved/finalised), admin_comments, generated_pdf_url, final_signed_pdf_url, submitted_at, approved_at, finalised_at, created_at, updated_at

### 5.4 DELIVERY_LOCATION_ITEMS Table

**Fields**: id, delivery_id, location_id, route_number, building_number, office_name, sup_number, estimated_bottles, issued_quantity, received_quantity, officer_name, officer_signature_url, no_issue_needed, status (pending/completed/no_issue_needed), completed_at, notes, created_at, updated_at

**Note**: Each delivery must have one line for every location.

### 5.5 REPORT_EXPORTS Table

**Fields**: id, admin_id, export_type (csv/excel/pdf), filter_start_date, filter_end_date, generated_file_url, created_at

## 6. Exception and Boundary Conditions

| Scenario | Handling |
|----------|----------|
| Vendor attempts to submit delivery with incomplete locations | Submit to Admin button remains disabled, display message indicating incomplete locations |
| Vendor attempts to download PDF before admin approval | PDF download button disabled or hidden, display message: \"PDF pending admin approval\" |
| Admin attempts to approve delivery without signature | Approve button disabled until Admin Full Name and Admin Signature are provided |
| Vendor attempts to access another vendor's delivery | Access denied, redirect to Vendor Dashboard |
| Vendor attempts to access admin pages | Access denied, redirect to Vendor Dashboard |
| Admin attempts to edit finalised delivery | Edit functionality disabled for finalised deliveries |
| Negative values entered for Issued Quantity or Received Quantity | Validation error, prevent save |
| Location marked as inactive | Location does not appear in new deliveries, remains visible in historical reports |
| Vendor deactivated | Vendor cannot login, existing deliveries remain accessible to Admin |
| Email sending fails | Display error message, allow retry |
| PDF generation fails | Display error message, allow retry |
| No active locations available | Vendor cannot start new delivery, display message indicating no active locations |

## 7. Data Validation

- Delivery date is required
- Vendor full name is required
- Every active location must be completed before submission
- Issued Quantity cannot be negative
- Received Quantity cannot be negative
- Officer Name required unless No Issue Needed
- Officer Signature required unless No Issue Needed
- Vendor Signature required before submitting to Admin
- Admin Signature required before final approval
- PDF cannot be finalised without Admin signature

## 8. Seed Data

**Sample Locations**:
1. Route Number: 1, Building Number: D001, Office Name: Office of the Chief of Mission, SUP Number: SUP03397
2. Route Number: 2, Building Number: D001, Office Name: CMS, SUP Number: SUP03682
3. Route Number: 3, Building Number: B055, Office Name: UNPOL, SUP Number: SUP03648
4. Route Number: 4, Building Number: E091, Office Name: Centralized Warehouse, SUP Number: SUP02236
5. Route Number: 5, Building Number: 565, Office Name: Aviation, SUP Number: SUP03377

**Note**: Admin can import full location list later using CSV.

## 9. Acceptance Criteria

1. Vendor logs in, starts new delivery, completes all location deliveries with officer signatures, submits to Admin
2. Admin logs in, reviews submitted delivery, approves with admin signature
3. System generates final signed PDF titled \"WATER BOTTLES DELIVERY WAYBILL\"
4. Vendor views delivery history and downloads final approved PDF
5. Admin views reports page with filters, charts, and tables
6. Admin exports filtered data to CSV and Excel
7. Admin manages locations (add, edit, deactivate, reorder)
8. Admin sends final PDF by email using Resend API

## 10. Out of Scope for This Release

- File size or type restrictions for signatures
- Multi-language support
- Mobile native app versions (iOS/Android)
- Real-time notifications or push notifications
- Advanced user management (password complexity rules, multi-factor authentication)
- Integration with external logistics systems
- Automated delivery scheduling
- GPS tracking during delivery
- Barcode or QR code scanning
- Offline mode functionality
- Advanced analytics (predictive analytics, machine learning)
- Custom report builder
- Role customization beyond VENDOR and ADMIN
- Delivery route optimization
- Inventory management integration
- Billing or invoicing functionality