# Phase 50 Operational Activation Runbook

Pre-populated with production UUIDs retrieved 2026-06-19.
Execute these steps exactly in order. Stop and report any blocker.

---

## Part A — Universities Mixed Batch

### A1. Create the mixed batch

Navigate to `/admin/imports`.
Click "Create new batch".
Set batch type: `mixed`.
Note the batch ID from the URL when it opens: `/admin/imports/<batch-id>`.

Record batch ID: ___________________________________

### A2. Import the 8 university stubs

From the batch detail page, expand **Bulk JSON Import**.
Set entity type: `universities`.
Paste the contents of `data/starter/universities.phase50-batch.json`:

```json
[
  { "name": "University of Helsinki", "country_code": "FI", "official_url": "https://www.helsinki.fi/en" },
  { "name": "Aalto University", "country_code": "FI", "official_url": "https://www.aalto.fi/en" },
  { "name": "Tampere University", "country_code": "FI", "official_url": "https://www.tuni.fi/en" },
  { "name": "University of Oulu", "country_code": "FI", "official_url": "https://www.oulu.fi/en" },
  { "name": "University of Turku", "country_code": "FI", "official_url": "https://www.utu.fi/en" },
  { "name": "University of Jyväskylä", "country_code": "FI", "official_url": "https://www.jyu.fi/en" },
  { "name": "LUT University", "country_code": "FI", "official_url": "https://www.lut.fi/en" },
  { "name": "University of Vaasa", "country_code": "FI", "official_url": "https://www.uwasa.fi/en" }
]
```

Expected: 8 inserted, 0 warned, 0 failed.

### A3. Run quality checks

Click **Run Quality Checks**. Expect `possible_production_match` warnings for the 6
universities that already exist in production. These are expected — do not reject
based on this alone.

### A4. Approve all 8 staged university rows

For each of the 8 rows, expand the review form and click **Approve**.
No review notes needed unless something looks wrong.

### A5. Link 6 existing universities to production

For each of the 6 universities below, expand the **"Link to existing production
university"** details form in the row's Actions column. Paste the UUID and click Link.

| University | Production UUID to paste |
|---|---|
| University of Helsinki | `2044a834-06ba-4dc9-b216-28300d46add9` |
| Aalto University | `08549fc9-ee7b-4f73-9069-5c6430f117ae` |
| Tampere University | `c32082d8-649a-4fb7-adb8-76d4fd549ee9` |
| University of Oulu | `cf413676-3860-405b-aa84-a93f0fe1219b` |
| University of Turku | `a4e45952-c1a7-4196-add6-fe528c06becb` |
| University of Jyväskylä | `1b80aada-0408-49a6-836e-98c1d2bc70ec` |

After each Link, the row's action area should switch to the **"Update Existing"** merge form.

LUT University and University of Vaasa: skip this step — they will use create_new.

### A6. Merge the 6 linked universities with update_existing

For each of the 6 linked rows, check **"I confirm this writes to a production record"**
and click **Update Existing**.

Expected: staging row status changes to `merged`.

### A7. Merge LUT University and University of Vaasa with create_new

For LUT University and University of Vaasa (which have no production match),
check **"I confirm this creates a production record"** and click **Merge to Production**.

Expected: 2 new draft university production rows created; staging rows show `merged`.

### A8. Record the staging UUIDs for all 8 university rows

After all 8 are merged, note the staging row ID (UUID) shown in the row header or URL.
The staging UUID is the `id` column value in `staging_universities`, NOT the production UUID.

The easiest way to find each staging UUID is from the row in the batch detail table.
Look at the row's "review…" form: `<input type="hidden" name="row_id" value="STAGING-UUID">`.
Inspect element on any approved row's review form to find it.

Alternatively: after all merges, check the URL of the merge form hidden field.

Record here (fill in before proceeding to Part B):

| University | Staging UUID |
|---|---|
| University of Helsinki | ___________________________________ |
| Aalto University | ___________________________________ |
| Tampere University | ___________________________________ |
| University of Oulu | ___________________________________ |
| University of Turku | ___________________________________ |
| University of Jyväskylä | ___________________________________ |
| LUT University | ___________________________________ |
| University of Vaasa | ___________________________________ |

---

## Part B — Programs Import

### B1. Fill staging UUIDs into programs JSON

Edit `data/starter/programs.phase50.json`.
For each `REPLACE_WITH_STAGING_UUID` placeholder, replace it with the corresponding
staging UUID from the table in A8.

The file has 13 programs across 8 universities. The `_university_name` field shows
which university each program belongs to.

After editing, verify:
- No `REPLACE_WITH_STAGING_UUID` remains in the file
- Each `staging_university_id` is a valid UUID (36 chars, hyphens)

### B2. Import the 13 programs

From the same mixed batch (the one from A1), expand **Bulk JSON Import**.
Set entity type: `programs`.
Paste the full content of `data/starter/programs.phase50.json`.

Expected: 13 inserted, 0 warned, 0 failed.

Stop if any programs fail — check `staging_university_id` UUID format.

### B3. Run quality checks

Click **Run Quality Checks**. Note any warnings.

### B4. Review all 13 program rows

For each program row, expand the review form.
Approve each row where the title matches the official source.
Use `data/starter/programs.phase50.sources.md` as reference for each title and university.

Reject any row where:
- The `staging_university_id` did not resolve (shows a UUID mismatch warning)
- The title is truncated or wrong

### B5. Merge each approved program with create_new

For each approved program row, confirm and click **Merge to Production**.

Expected: 13 draft program production rows created.

### B6. Add data sources for each merged program

After merging, open each program's admin edit page (link from the merge success or
from `/admin/programs`).

For each program, scroll to **Data Sources** and add:
- source_type: `official_university`
- confidence_level: `high`
- is_primary_source: `true`
- URL: (copy from `data/starter/programs.phase50.sources.md` for each program)

Source URLs by university:
- University of Helsinki programs: `https://www.helsinki.fi/en/degree-programmes/computer-science-masters-programme` and `https://www.helsinki.fi/en/degree-programmes/data-science-masters-programme`
- Aalto programs: `https://www.aalto.fi/en/programmes/masters-programme-in-computer-communication-and-information-sciences`
- Tampere programs: `https://www.tuni.fi/en/study-with-us/degree-programmes/masters-programme-in-computing-sciences`
- University of Oulu programs: `https://www.oulu.fi/en/apply/masters-programme-computer-science-and-engineering` and `https://www.oulu.fi/en/apply/masters-programme-wireless-communications-engineering`
- University of Turku: `https://www.utu.fi/en/study-at-utu/masters-programmes/information-and-communication-technology`
- University of Jyväskylä: `https://www.jyu.fi/en/apply/masters-programmes/mathematical-information-technology`
- LUT University: `https://www.lut.fi/en/studies/masters-programmes/software-engineering`
- University of Vaasa: `https://www.uwasa.fi/en/education/masters-programmes/computer-science`

### B7. Publish each merged program

On each program's admin edit page, change content_status from `draft` to `published`.
Confirm each publish action.

---

## Part C — Articles Import

### C1. Create a new articles batch

Navigate to `/admin/imports`. Create a new batch.
Set batch type: `articles`.

Record batch ID: ___________________________________

### C2. Import the 2 guide articles

Expand **Bulk JSON Import**.
Set entity type: `articles`.
Paste the full content of `data/starter/articles.phase50.json`.

Expected: 2 inserted, 0 warned, 0 failed.

### C3. Run quality checks

Click **Run Quality Checks**. Expect no warnings for fresh slugs.

### C4. Review and approve both article rows

For each article, expand the review form and click **Approve**.

### C5. Merge both articles with create_new

Confirm and click **Merge to Production** for each.

Note: No data source attachment for articles — `official_editorial` is not a valid
source_type in the schema. Skip the data source step for articles.

### C6. Set article_category_id manually

After merge, open each article's admin edit page at `/admin/articles`.
Set the category field:
- "Study in Finland: A Starter Guide for International Students" → `country-guides`
- "How to Compare English-Taught Master's Programmes in Finland" → `program-guides`

### C7. Add data sources for LUT and Vaasa universities

After LUT and Vaasa are created in A7, open each university's admin edit page and
add an official data source:
- LUT University: source_type `official_university`, URL `https://www.lut.fi/en`
- University of Vaasa: source_type `official_university`, URL `https://www.uwasa.fi/en`

Set confidence_level `high`, is_primary_source `true` for both.

### C8. Publish LUT University and University of Vaasa

On each new university's admin edit page, publish the draft row.

### C9. Publish both articles

On each article's admin edit page, change content_status to `published`.

---

## Part D — Public Verification

### D1. Programs list

Navigate to `/programs` and confirm Finland programs appear.
Expected: at least 13 new programs visible (some may need filter to find).

### D2. Program detail pages

Open at least 2 program detail pages. Confirm:
- Title shows correctly
- University name links correctly
- Degree level shows "Master's"
- Language shows "English"

### D3. Guides list

Navigate to `/guides`. Confirm the 2 new articles appear.

### D4. Article detail pages

Open both article detail pages. Confirm:
- Title renders correctly
- Content renders (not empty)
- Slug matches: `study-in-finland-starter-guide` and `compare-english-masters-finland`

### D5. Fit Finder

Navigate to `/fit-finder`.
Enter a profile with country preference Finland and degree level Master's.
Confirm Finland programs appear in results.

---

## Part E — Final Report

After completing all steps, report:
- Batch IDs (mixed batch, articles batch)
- Universities merged: count and names
- Programs imported / merged / published count
- Articles imported / merged / published count
- Data sources added count
- Any rows rejected or skipped and reasons
- Public verification results for each URL checked
- Any errors or blockers encountered
