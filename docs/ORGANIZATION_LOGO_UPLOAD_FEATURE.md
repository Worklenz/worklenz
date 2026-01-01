# Organization Logo Upload Feature - QA Documentation

## Overview

This feature allows paid users (Business and Enterprise plan subscribers) to upload and manage their organization logo. The uploaded logo replaces the default Worklenz logo in the application navbar throughout the entire application. Users can upload, change, or remove their organization logo from the Admin Center > Overview > Organization Profile section.

**Key Points:**
- Only available for paid plan users (Business/Enterprise)
- Logo appears in the navbar across all pages
- Logo can be uploaded, changed, or deleted
- Logo specifications and recommendations are provided to users

---

## Goals & Non-Goals

### Goals

1. **Branding Customization**: Allow organizations to display their company logo instead of the default Worklenz logo
2. **User Experience**: Provide an intuitive interface for logo management in the Admin Center
3. **Visual Consistency**: Display the organization logo consistently across all pages in the navbar
4. **Quality Control**: Guide users to upload logos that meet optimal specifications for best display results
5. **Access Control**: Restrict logo upload feature to paid plan users only

### Non-Goals

1. **Logo Editing**: This feature does not include in-app logo editing, cropping, or resizing tools
2. **Multiple Logos**: Users cannot upload different logos for different teams or contexts
3. **Logo Animation**: Animated logos (GIF) are not supported
4. **SVG Support**: SVG format is not currently supported (may be added in future)
5. **Logo Templates**: No pre-designed logo templates are provided
6. **Bulk Operations**: Cannot upload or manage multiple logos at once

---

## Requirements

### Functional Requirements

#### FR1: Access Control
- **FR1.1**: Logo upload feature must only be accessible to users with Business or Enterprise subscription plans
- **FR1.2**: Free plan users should not see the logo upload option or should see a message indicating the feature requires a paid plan
- **FR1.3**: Only organization owners and admins can upload/manage the logo
- **FR1.4**: Regular team members cannot access logo management features

#### FR2: Logo Upload
- **FR2.1**: Users must be able to upload a logo from the Admin Center > Overview > Organization Profile section
- **FR2.2**: Supported file formats: PNG, JPG, JPEG, WEBP
- **FR2.3**: Maximum file size: 5MB
- **FR2.4**: Users should see a preview of the selected logo before confirming upload
- **FR2.5**: Upload should show loading state during processing
- **FR2.6**: Success message should appear after successful upload
- **FR2.7**: Logo should appear immediately in the upload area after successful upload
- **FR2.8**: Logo should appear in the navbar immediately after upload (no page refresh required)

#### FR3: Logo Display
- **FR3.1**: Uploaded logo must replace the default Worklenz logo in the navbar
- **FR3.2**: Logo should appear in navbar across all pages of the application
- **FR3.3**: Logo should maintain proper aspect ratio and sizing in navbar (max 44px height, 140px width)
- **FR3.4**: If no logo is uploaded, default Worklenz logo should display
- **FR3.5**: Logo should be visible in both light and dark themes
- **FR3.6**: Logo should display correctly on mobile, tablet, and desktop devices

#### FR4: Logo Management
- **FR4.1**: Users must be able to change/replace an existing logo
- **FR4.2**: Users must be able to delete/remove the uploaded logo
- **FR4.3**: Deletion should require confirmation before proceeding
- **FR4.4**: After deletion, default Worklenz logo should reappear in navbar
- **FR4.5**: Logo preview should update immediately after upload or deletion

#### FR5: Validation & Warnings
- **FR5.1**: System must reject files that are not PNG, JPG, JPEG, or WEBP format
- **FR5.2**: System must reject files larger than 5MB
- **FR5.3**: System should warn users if file size is over 500KB (recommended limit)
- **FR5.4**: System should warn users if logo dimensions are too small (below 200×60px)
- **FR5.5**: System should warn users if logo dimensions are very large (above 800×240px)
- **FR5.6**: System should warn users if logo is vertical/portrait orientation (landscape recommended)
- **FR5.7**: Error messages must be clear and user-friendly
- **FR5.8**: Validation warnings should not prevent upload, only inform the user

#### FR6: User Guidance
- **FR6.1**: Users should see recommended logo specifications (format, size, dimensions)
- **FR6.2**: Tooltip or help text should explain logo format recommendations
- **FR6.3**: Image dimensions and file size should be displayed after file selection
- **FR6.4**: Recommended specifications should be visible in the upload area

### Non-Functional Requirements

#### NFR1: Performance
- **NFR1.1**: Logo upload should complete within 10 seconds for files under 5MB
- **NFR1.2**: Navbar logo should load within 2 seconds on page load
- **NFR1.3**: Logo preview should appear immediately after file selection
- **NFR1.4**: No noticeable performance degradation when logo is displayed in navbar

#### NFR2: Usability
- **NFR2.1**: Upload interface should be intuitive and require no training
- **NFR2.2**: All user-facing text must be localized (English, Chinese, Portuguese, Spanish, German, Albanian)
- **NFR2.3**: Error messages must be clear and actionable
- **NFR2.4**: Upload area should provide visual feedback on hover
- **NFR2.5**: Loading states should be clearly visible during upload/delete operations

#### NFR3: Accessibility
- **NFR3.1**: Upload area must be keyboard accessible
- **NFR3.2**: Screen readers must announce upload area and actions
- **NFR3.3**: Focus indicators must be visible for keyboard navigation
- **NFR3.4**: Alt text must be provided for logo images
- **NFR3.5**: Color contrast must meet WCAG AA standards

#### NFR4: Compatibility
- **NFR4.1**: Feature must work in all supported browsers (Chrome, Firefox, Safari, Edge)
- **NFR4.2**: Feature must work on mobile devices (iOS Safari, Chrome Mobile)
- **NFR4.3**: Logo must display correctly in both light and dark themes
- **NFR4.4**: Feature must work with touch and mouse interactions

#### NFR5: Security
- **NFR5.1**: Only authenticated organization owners/admins can upload logos
- **NFR5.2**: File type validation must prevent malicious file uploads
- **NFR5.3**: File size limits must be enforced server-side
- **NFR5.4**: Old logos must be deleted from storage when replaced or removed

#### NFR6: Reliability
- **NFR6.1**: Upload should handle network interruptions gracefully
- **NFR6.2**: Failed uploads should show clear error messages
- **NFR6.3**: Logo should fallback to default if custom logo fails to load
- **NFR6.4**: System should handle concurrent upload attempts appropriately

---

## User Flows

### Flow 1: Uploading Organization Logo (First Time)

```
1. User navigates to Admin Center > Overview
2. User sees "Organization Profile" section
3. User sees "Logo" card with upload area (shows placeholder with "+" icon)
4. User clicks on upload area or "Upload Logo" button
5. File picker dialog opens
6. User selects an image file (PNG, JPG, JPEG, or WEBP)
7. System validates file:
   - If invalid format → Shows error message, upload cancelled
   - If file too large (>5MB) → Shows error message, upload cancelled
   - If valid → Shows preview with dimensions and file size
8. System shows warnings if applicable (large file, small dimensions, vertical orientation)
9. User confirms upload (automatic on file selection)
10. Loading spinner appears
11. Upload completes:
    - Success message appears
    - Logo preview updates in upload area
    - Logo appears in navbar immediately
12. User sees "Change Logo" and "Remove Logo" buttons
```

### Flow 2: Changing Existing Logo

```
1. User navigates to Admin Center > Overview
2. User sees current logo displayed in "Logo" card
3. User clicks "Change Logo" button
4. File picker dialog opens
5. User selects new image file
6. System validates and shows preview
7. User confirms upload
8. Loading spinner appears
9. Old logo is replaced with new logo:
    - Success message appears
    - Preview updates
    - Navbar logo updates immediately
10. Old logo is deleted from storage (background process)
```

### Flow 3: Removing Logo

```
1. User navigates to Admin Center > Overview
2. User sees current logo displayed in "Logo" card
3. User clicks "Remove Logo" button
4. Confirmation dialog appears: "Are you sure you want to remove the organization logo? This action cannot be undone."
5. User clicks "Yes" to confirm or "No" to cancel
6. If confirmed:
   - Loading state appears on button
   - Logo is deleted from storage
   - Logo URL is removed from database
   - Success message appears
   - Upload area shows placeholder again
   - Default Worklenz logo reappears in navbar
7. If cancelled:
   - Dialog closes, no changes made
```

### Flow 4: Viewing Logo in Navbar

```
1. User logs into application
2. System checks if organization has custom logo
3. If logo exists:
   - Custom logo appears in navbar (replacing Worklenz logo)
   - Logo maintains proper sizing (max 44px height, 140px width)
   - Logo appears on all pages
4. If no logo:
   - Default Worklenz logo appears
   - Christmas variant shows in December (if no custom logo)
5. User navigates between pages
6. Logo remains consistent across all pages
```

### Flow 5: Access Denied (Free Plan User)

```
1. Free plan user navigates to Admin Center > Overview
2. User does NOT see "Logo" card in Organization Profile section
   OR
   User sees "Logo" card but upload is disabled with message about paid plan requirement
3. If user attempts to access upload endpoint directly:
   - System returns 403 error
   - Error message: "This feature requires a Business plan"
```

---

## User Flow Diagrams

### Upload Logo Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Admin Center > Overview                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Organization Profile Section                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Logo Card                                          │   │
│  │  [Upload Area with Placeholder]                    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    [Click Upload Area]
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    File Picker Dialog                       │
│  User selects: PNG, JPG, JPEG, or WEBP file                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    [File Selected]
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Validation & Preview                      │
│  ✓ Check file format (PNG/JPG/JPEG/WEBP)                   │
│  ✓ Check file size (<5MB)                                   │
│  ✓ Show preview with dimensions                            │
│  ⚠ Show warnings if needed (size, dimensions, orientation) │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    [Upload Confirmed]
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Upload Processing                         │
│  [Loading Spinner]                                          │
│  • Convert to base64                                        │
│  • Upload to S3 storage                                     │
│  • Update database                                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    [Upload Complete]
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Success State                             │
│  ✓ Success message displayed                                │
│  ✓ Logo preview updated                                     │
│  ✓ Logo appears in navbar                                   │
│  ✓ "Change Logo" and "Remove Logo" buttons visible          │
└─────────────────────────────────────────────────────────────┘
```

### Navbar Logo Display Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Load                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Fetch Organization Details                      │
│  Check if organization has logo_url                         │
└─────────────────────────────────────────────────────────────┘
                            │
                    ┌───────┴───────┐
                    │               │
                    ▼               ▼
        ┌──────────────────┐  ┌──────────────────┐
        │  Logo Exists?     │  │  No Logo?        │
        │  Yes              │  │  Yes             │
        └──────────────────┘  └──────────────────┘
                    │               │
                    ▼               ▼
        ┌──────────────────┐  ┌──────────────────┐
        │  Display Custom   │  │  Display Default │
        │  Logo in Navbar   │  │  Worklenz Logo   │
        │  • Max 44px high  │  │  (with Christmas │
        │  • Max 140px wide │  │   variant if Dec)│
        │  • Preserve ratio │  │                  │
        └──────────────────┘  └──────────────────┘
                    │               │
                    └───────┬───────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Logo Displayed in Navbar                         │
│  • Visible on all pages                                      │
│  • Updates immediately after upload/delete                   │
│  • Falls back to default on load error                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

### AC1: Logo Upload - Successful Upload

**Given:** User has Business/Enterprise plan and is on Admin Center > Overview page  
**When:** User uploads a valid logo file (PNG, 400×120px, 200KB)  
**Then:**
- File is accepted without errors
- Preview shows immediately with correct dimensions
- Upload completes successfully
- Success message appears: "Logo uploaded successfully"
- Logo appears in upload area preview
- Logo appears in navbar immediately (no page refresh)
- "Change Logo" and "Remove Logo" buttons are visible
- Logo persists after page refresh

### AC2: Logo Upload - Invalid File Format

**Given:** User is on logo upload page  
**When:** User attempts to upload a file that is not PNG, JPG, JPEG, or WEBP (e.g., PDF, DOCX)  
**Then:**
- File picker may allow selection, but on upload attempt:
- Error message appears: "Only PNG, JPG, JPEG, and WEBP images are allowed"
- Upload is cancelled
- No changes are made to current logo
- User can try again with correct format

### AC3: Logo Upload - File Too Large

**Given:** User is on logo upload page  
**When:** User attempts to upload a file larger than 5MB  
**Then:**
- Error message appears: "Logo file size must be less than 5MB"
- Upload is rejected
- No changes are made to current logo
- User can try again with smaller file

### AC4: Logo Upload - Warning for Large File

**Given:** User is on logo upload page  
**When:** User selects a valid file between 500KB and 5MB  
**Then:**
- Warning message appears: "File size is large. Recommended: under 500KB for optimal performance"
- Upload can still proceed
- User can choose to continue or cancel

### AC5: Logo Upload - Warning for Small Dimensions

**Given:** User is on logo upload page  
**When:** User selects a logo smaller than 200×60px  
**Then:**
- Warning message appears: "Logo is too small. Recommended minimum: 200×60px"
- Upload can still proceed
- Preview shows actual dimensions
- User can choose to continue or cancel

### AC6: Logo Upload - Warning for Large Dimensions

**Given:** User is on logo upload page  
**When:** User selects a logo larger than 800×240px  
**Then:**
- Warning message appears: "Logo dimensions are very large. Recommended maximum: 800×240px"
- Upload can still proceed
- Preview shows actual dimensions
- User can choose to continue or cancel

### AC7: Logo Upload - Warning for Vertical Logo

**Given:** User is on logo upload page  
**When:** User selects a vertical/portrait logo (height > 2× width)  
**Then:**
- Warning message appears: "Vertical logos may appear small in the navbar. Landscape orientation is recommended"
- Upload can still proceed
- User can choose to continue or cancel

### AC8: Logo Display - Navbar

**Given:** Organization has uploaded a logo  
**When:** User views any page in the application  
**Then:**
- Custom organization logo appears in navbar (not default Worklenz logo)
- Logo is properly sized (max 44px height, 140px width)
- Logo maintains aspect ratio
- Logo is visible in both light and dark themes
- Logo appears consistently across all pages

### AC9: Logo Display - No Logo

**Given:** Organization has not uploaded a logo  
**When:** User views any page in the application  
**Then:**
- Default Worklenz logo appears in navbar
- Christmas variant appears in December (if applicable)
- Logo displays correctly in both themes

### AC10: Change Logo

**Given:** Organization has an existing logo  
**When:** User clicks "Change Logo" and uploads a new logo  
**Then:**
- New logo replaces old logo
- Old logo is deleted from storage (background process)
- Success message appears
- Preview updates immediately
- Navbar logo updates immediately
- New logo persists after page refresh

### AC11: Remove Logo

**Given:** Organization has an existing logo  
**When:** User clicks "Remove Logo" and confirms deletion  
**Then:**
- Confirmation dialog appears with clear message
- If confirmed:
  - Logo is deleted from storage
  - Logo URL is removed from database
  - Success message appears: "Logo removed successfully"
  - Upload area shows placeholder again
  - Default Worklenz logo reappears in navbar immediately
- If cancelled:
  - Dialog closes
  - No changes are made
  - Logo remains unchanged

### AC12: Access Control - Paid User

**Given:** User has Business or Enterprise plan  
**When:** User navigates to Admin Center > Overview  
**Then:**
- "Logo" card is visible in Organization Profile section
- Upload functionality is accessible
- No restrictions or upgrade prompts appear

### AC13: Access Control - Free User

**Given:** User has Free plan  
**When:** User navigates to Admin Center > Overview  
**Then:**
- Logo upload feature is not accessible
- If user attempts to access upload endpoint:
  - Error message: "This feature requires a Business plan"
  - Upload is rejected

### AC14: Loading States

**Given:** User is uploading or deleting a logo  
**When:** Operation is in progress  
**Then:**
- Loading spinner is clearly visible
- Upload/delete button shows loading state
- User cannot initiate another upload/delete during operation
- UI provides clear feedback that operation is in progress

### AC15: Error Handling - Network Failure

**Given:** User is uploading a logo  
**When:** Network connection is lost during upload  
**Then:**
- Error message appears: "Failed to upload logo" or similar
- Upload area returns to previous state
- No partial uploads are saved
- User can retry upload

### AC16: Error Handling - Logo Load Failure

**Given:** Organization has uploaded a logo  
**When:** Logo image fails to load in navbar (broken URL, network issue)  
**Then:**
- System falls back to default Worklenz logo
- No broken image icon appears
- Application continues to function normally
- Error is logged but not shown to user

### AC17: Responsive Design - Desktop

**Given:** User is on desktop (1920×1080 or larger)  
**When:** User views logo upload page  
**Then:**
- Logo upload area displays properly
- All buttons and text are readable
- Layout uses available space efficiently
- Grid layout shows logo, name, and owner side-by-side

### AC18: Responsive Design - Tablet

**Given:** User is on tablet (768px - 1024px width)  
**When:** User views logo upload page  
**Then:**
- Logo upload area is appropriately sized
- Layout adapts to tablet screen size
- All functionality remains accessible
- Touch interactions work properly

### AC19: Responsive Design - Mobile

**Given:** User is on mobile device (<768px width)  
**When:** User views logo upload page  
**Then:**
- Logo upload area is full width or appropriately sized
- Layout stacks vertically
- All buttons are touch-friendly (adequate size)
- File picker works on mobile browsers
- Logo displays correctly in mobile navbar

### AC20: Theme Support - Light Mode

**Given:** User has light theme enabled  
**When:** User views logo upload interface and navbar  
**Then:**
- All UI elements are visible with proper contrast
- Logo upload area has light background
- Text is readable
- Logo is visible in light navbar
- All colors meet accessibility standards

### AC21: Theme Support - Dark Mode

**Given:** User has dark theme enabled  
**When:** User views logo upload interface and navbar  
**Then:**
- All UI elements are visible with proper contrast
- Logo upload area has dark background
- Text is readable
- Logo is visible in dark navbar
- All colors meet accessibility standards

### AC22: Localization - All Languages

**Given:** User has language set to English, Chinese, Portuguese, Spanish, German, or Albanian  
**When:** User views logo upload interface  
**Then:**
- All text is displayed in selected language
- Error messages are in selected language
- Success messages are in selected language
- Tooltips and help text are in selected language
- No hardcoded English text appears

### AC23: Image Preview

**Given:** User has selected a valid image file  
**When:** File is selected but before upload confirmation  
**Then:**
- Image preview appears in upload area
- Image dimensions are displayed (e.g., "400 × 120px")
- File size is displayed (e.g., "245.3 KB")
- Preview matches the actual image
- User can see how logo will look before uploading

### AC24: Logo Specifications Display

**Given:** User is on logo upload page  
**When:** User views the logo upload area  
**Then:**
- Recommended specifications are visible:
  - Format: PNG format with transparent background is recommended
  - Size: 400×120px (landscape), max 800×240px
  - File size: Under 500KB recommended
- Info icon provides additional details on hover
- Specifications are clearly readable

### AC25: Concurrent Operations

**Given:** User has uploaded a logo  
**When:** User attempts to upload a new logo while another upload is in progress  
**Then:**
- Second upload attempt is prevented or queued
- Clear feedback indicates operation in progress
- No conflicts or errors occur
- Only one logo exists after operations complete

---

## Test Scenarios

### Scenario 1: Happy Path - First Logo Upload
1. Login as Business plan user
2. Navigate to Admin Center > Overview
3. Verify "Logo" card is visible
4. Click upload area
5. Select valid PNG logo (400×120px, 200KB)
6. Verify preview appears with dimensions
7. Verify upload completes successfully
8. Verify logo appears in upload area
9. Verify logo appears in navbar
10. Refresh page and verify logo persists

### Scenario 2: Invalid File Format
1. Login as Business plan user
2. Navigate to Admin Center > Overview
3. Click upload area
4. Attempt to upload PDF file
5. Verify error message appears
6. Verify upload is rejected
7. Verify no changes to current logo (if exists)

### Scenario 3: File Too Large
1. Login as Business plan user
2. Navigate to Admin Center > Overview
3. Click upload area
4. Attempt to upload 6MB image file
5. Verify error message appears
6. Verify upload is rejected

### Scenario 4: Change Logo
1. Login as Business plan user with existing logo
2. Navigate to Admin Center > Overview
3. Verify current logo is displayed
4. Click "Change Logo"
5. Select new logo file
6. Verify new logo replaces old logo
7. Verify navbar updates immediately

### Scenario 5: Remove Logo
1. Login as Business plan user with existing logo
2. Navigate to Admin Center > Overview
3. Click "Remove Logo"
4. Verify confirmation dialog appears
5. Click "Yes" to confirm
6. Verify logo is removed
7. Verify default Worklenz logo appears in navbar
8. Verify upload area shows placeholder

### Scenario 6: Cancel Logo Removal
1. Login as Business plan user with existing logo
2. Navigate to Admin Center > Overview
3. Click "Remove Logo"
4. Verify confirmation dialog appears
5. Click "No" to cancel
6. Verify dialog closes
7. Verify logo remains unchanged

### Scenario 7: Free User Access
1. Login as Free plan user
2. Navigate to Admin Center > Overview
3. Verify logo upload feature is not accessible
4. If visible, verify it's disabled with appropriate message

### Scenario 8: Navbar Logo Display
1. Login as Business plan user with logo
2. Navigate to different pages (Home, Projects, Tasks, etc.)
3. Verify custom logo appears in navbar on all pages
4. Verify logo sizing is consistent
5. Switch between light and dark themes
6. Verify logo is visible in both themes

### Scenario 9: Responsive Testing
1. Test on desktop (1920×1080)
2. Test on tablet (768×1024)
3. Test on mobile (375×667)
4. Verify logo upload interface adapts correctly
5. Verify navbar logo displays correctly on all sizes
6. Verify all interactions work (click, touch)

### Scenario 10: Error Recovery
1. Login as Business plan user
2. Start logo upload
3. Disconnect network during upload
4. Verify error message appears
5. Reconnect network
6. Verify user can retry upload
7. Verify no partial/corrupted uploads exist

---

## Edge Cases

1. **Very Small Logo**: Upload logo with dimensions 50×20px - should show warning but allow upload
2. **Very Large Logo**: Upload logo with dimensions 2000×600px - should show warning but allow upload
3. **Square Logo**: Upload square logo (400×400px) - should work but may appear small in navbar
4. **Vertical Logo**: Upload tall logo (200×800px) - should show warning about vertical orientation
5. **Large File Size**: Upload 4.9MB file - should show warning but allow upload
6. **Special Characters in Filename**: Upload file with special characters - should handle gracefully
7. **Rapid Uploads**: Upload multiple logos in quick succession - should handle appropriately
8. **Logo with Transparency**: Upload PNG with transparent background - should display correctly
9. **Logo on Dark Background**: Upload dark logo - verify visibility in light navbar
10. **Logo on Light Background**: Upload light logo - verify visibility in dark navbar
11. **Christmas Season**: Upload logo in December - custom logo should still show (not Christmas variant)
12. **Browser Back Button**: Upload logo, then press browser back - verify logo persists
13. **Multiple Tabs**: Upload logo in one tab, verify updates in other tabs
14. **Session Expiry**: Upload logo, let session expire, verify logo persists after re-login

---

## Known Limitations

1. **SVG Format**: SVG logos are not currently supported (only raster formats)
2. **Logo Editing**: No in-app cropping or resizing tools - users must prepare logo externally
3. **Multiple Logos**: Only one logo per organization - cannot have different logos for different contexts
4. **Logo Animation**: Animated GIFs are not supported
5. **Logo Templates**: No pre-designed templates provided
6. **Bulk Operations**: Cannot upload multiple logos at once

---

## Browser Compatibility

- **Chrome**: Latest 2 versions - Full support
- **Firefox**: Latest 2 versions - Full support
- **Safari**: Latest 2 versions - Full support
- **Edge**: Latest 2 versions - Full support
- **Mobile Safari (iOS)**: iOS 14+ - Full support
- **Chrome Mobile (Android)**: Android 10+ - Full support

---

## Notes for QA Team

1. **Test Data**: Ensure test accounts have Business/Enterprise plans for full feature testing
2. **Logo Files**: Prepare test logo files in various formats and sizes:
   - Valid: PNG 400×120px (200KB), JPG 400×120px (150KB), WEBP 400×120px (100KB)
   - Invalid: PDF, DOCX, TXT files
   - Edge cases: Very small (50×20px), very large (2000×600px), vertical (200×800px)
3. **Network Testing**: Test with slow network, network interruptions, and offline scenarios
4. **Theme Testing**: Test thoroughly in both light and dark themes
5. **Responsive Testing**: Test on actual devices, not just browser dev tools
6. **Accessibility**: Use screen readers and keyboard-only navigation for testing
7. **Localization**: Test with all 6 supported languages
8. **Concurrent Users**: Test with multiple users uploading logos simultaneously
9. **Storage Cleanup**: Verify old logos are deleted when replaced (may require backend verification)
10. **Performance**: Monitor upload times and navbar load times

---

## Questions or Issues?

If you encounter any issues during testing or have questions about the feature, please document them with:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots/videos if applicable
- Browser/device information
- User account details (plan type, role)

