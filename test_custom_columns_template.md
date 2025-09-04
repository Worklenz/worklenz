# Testing Custom Column Template Feature

## Test Steps

### 1. Database Migration
- Run the migration script to create the necessary tables:
```sql
-- Run the migration at:
-- /worklenz-backend/database/migrations/20250204000000-add-custom-columns-to-templates.sql
```

### 2. Frontend Testing

#### A. Save Project as Template with Custom Columns
1. Open a project with custom columns configured
2. Click "Save as Template"
3. Check the new "Custom Columns" checkbox
4. Enter template name
5. Click Save

Expected Result:
- Template should be created with custom columns saved
- Database should have entries in:
  - `cpt_custom_columns`
  - `cpt_column_configurations` (if applicable)
  - `cpt_selection_options` (for dropdown columns)
  - `cpt_label_options` (for label columns)
  - `custom_project_templates.include_custom_columns` should be TRUE

#### B. Import Template with Custom Columns
1. Create new project from template
2. Select the template created in step A
3. Import the template

Expected Result:
- New project should have all custom columns from template
- Custom columns should have same configuration as in template
- Database should have entries in:
  - `cc_custom_columns`
  - `cc_column_configurations`
  - `cc_selection_options`
  - `cc_label_options`

### 3. Backend Testing

#### API Endpoints to Test:

1. **Create Template with Custom Columns**
   - Endpoint: `POST /api/project-templates/custom`
   - Body:
   ```json
   {
     "project_id": "<project-id>",
     "templateName": "Test Template with Columns",
     "projectIncludes": {
       "statuses": true,
       "phases": true,
       "labels": true
     },
     "taskIncludes": {
       "status": true,
       "phase": true,
       "labels": true,
       "estimation": true,
       "description": true,
       "subtasks": true
     },
     "includeCustomColumns": true
   }
   ```

2. **Import Template with Custom Columns**
   - Endpoint: `POST /api/project-templates/import-custom`
   - Body:
   ```json
   {
     "template_id": "<template-id>"
   }
   ```

### 4. Verification Queries

```sql
-- Check if custom columns were saved with template
SELECT * FROM cpt_custom_columns WHERE template_id = '<template-id>';

-- Check column configurations
SELECT * FROM cpt_column_configurations cc
JOIN cpt_custom_columns col ON col.id = cc.column_id
WHERE col.template_id = '<template-id>';

-- Check if template has custom columns flag
SELECT include_custom_columns FROM custom_project_templates WHERE id = '<template-id>';

-- Verify imported custom columns in new project
SELECT * FROM cc_custom_columns WHERE project_id = '<new-project-id>';
```

## Summary of Changes

### Database
- New tables: `cpt_custom_columns`, `cpt_column_configurations`, `cpt_selection_options`, `cpt_label_options`
- New column: `custom_project_templates.include_custom_columns`

### Backend
- Updated `pt-templates-controller.ts` to handle custom columns
- Added methods in `project-templates-base.ts`:
  - `getProjectCustomColumns()`
  - `insertCustomTemplateColumns()`
  - `getTemplateCustomColumns()`
  - `insertProjectCustomColumns()`
- Updated interfaces in `interfaces.ts`

### Frontend
- Added `includeCustomColumns` to `ICustomProjectTemplateCreateRequest`
- Added "Custom Columns" checkbox in SaveProjectAsTemplate component
- Updated translations

## Notes
- Custom columns are optional - controlled by checkbox
- All column configurations are preserved (type, width, visibility, etc.)
- Selection and label options are also preserved
- Formula columns with references need special handling (not implemented yet)