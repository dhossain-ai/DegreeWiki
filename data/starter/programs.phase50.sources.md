# Phase 50 Programs — Source URLs

All programs are English-taught master's programmes verified from official university pages.
Tuition amounts shown are per-academic-year in EUR for non-EU/EEA students where officially stated.
No deadlines are included as these change annually; check official pages for current information.

## Import Workflow — Staging UUID Assignment

After importing the Phase 49 universities into a new mixed batch and linking them to production
via `set_match_university_id`, note the staging UUID for each university row. Replace
`REPLACE_WITH_STAGING_UUID` in programs.phase50.json with the actual UUID for that university.

University-to-staging-UUID map (fill in after batch creation):

- University of Helsinki → ___________________________________
- Aalto University → ___________________________________
- Tampere University → ___________________________________
- University of Oulu → ___________________________________
- University of Turku → ___________________________________
- University of Jyväskylä → ___________________________________
- LUT University → ___________________________________
- University of Vaasa → ___________________________________

## University of Helsinki (2 programs)

Source: https://www.helsinki.fi/en/admissions-and-education/apply-bachelors-and-masters-programmes/masters-programmes

1. Master's Programme in Computer Science
   - Official page: https://www.helsinki.fi/en/degree-programmes/computer-science-masters-programme
   - Language: English (verified on official page)
   - Tuition: Not listed (EU/EEA waiver info only)

2. Master's Programme in Data Science
   - Official page: https://www.helsinki.fi/en/degree-programmes/data-science-masters-programme
   - Language: English (verified on official page)
   - Tuition: Not listed (EU/EEA waiver info only)

## Aalto University (2 programs)

Source: https://www.aalto.fi/en/programmes/masters-programmes

3. Master's Programme in Computer, Communication and Information Sciences — Computer Science
   - Official page: https://www.aalto.fi/en/programmes/masters-programme-in-computer-communication-and-information-sciences
   - Language: English (verified on official page)
   - Tuition: EUR 17,000/year for non-EU/EEA students (verified from Aalto tuition fee page)

4. Master's Programme in Computer, Communication and Information Sciences — Machine Learning, Data Science and Artificial Intelligence
   - Same programme umbrella as above; specialisation confirmed from Aalto majors list
   - Language: English
   - Tuition: EUR 17,000/year for non-EU/EEA students

## Tampere University (2 programs)

Source: https://www.tuni.fi/en/study-with-us/degree-programmes/masters-programmes

5. Master's Programme in Computing Sciences — Data Science
   - Official page: https://www.tuni.fi/en/study-with-us/degree-programmes/masters-programme-in-computing-sciences
   - Language: English (verified on official page)
   - Tuition: EUR 12,000/year for non-EU/EEA students (verified from Tampere tuition page)

6. Master's Programme in Computing Sciences — Software, Systems and Internet
   - Same programme umbrella; specialisation confirmed from Tampere major list
   - Language: English
   - Tuition: EUR 12,000/year for non-EU/EEA students

## University of Oulu (2 programs)

Source: https://www.oulu.fi/en/study-options?level=master&language=English

7. Master's Programme in Computer Science and Engineering
   - Official page: https://www.oulu.fi/en/apply/masters-programme-computer-science-and-engineering
   - Language: English (verified on official page)
   - Tuition: Not confirmed from official page at time of research

8. Master's Programme in Wireless Communications Engineering
   - Official page: https://www.oulu.fi/en/apply/masters-programme-wireless-communications-engineering
   - Language: English (verified on official page)
   - Tuition: Not confirmed from official page at time of research

## University of Turku (1 program)

Source: https://www.utu.fi/en/study-at-utu/masters-programmes

9. Master's Degree Programme in Information and Communication Technology
   - Official page: https://www.utu.fi/en/study-at-utu/masters-programmes/information-and-communication-technology
   - Language: English (verified on official page)
   - Tuition: Not confirmed from official page at time of research

## University of Jyväskylä (2 programs)

Source: https://www.jyu.fi/en/apply/masters-programmes

10. Master's Degree Programme in Mathematical Information Technology — Artificial Intelligence
    - Official page: https://www.jyu.fi/en/apply/masters-programmes/mathematical-information-technology
    - Language: English (verified on official page)
    - Tuition: EUR 12,000/year for non-EU/EEA students (verified from JYU tuition page)

11. Master's Degree Programme in Mathematical Information Technology — Cyber Security
    - Same programme umbrella; specialisation confirmed from JYU programme page
    - Language: English
    - Tuition: EUR 12,000/year for non-EU/EEA students

## LUT University (1 program)

Source: https://www.lut.fi/en/studies/masters-programmes

12. Master's Programme in Software Engineering
    - Official page: https://www.lut.fi/en/studies/masters-programmes/software-engineering
    - Language: English (verified on official page)
    - Tuition: Not confirmed from official page at time of research

## University of Vaasa (1 program)

Source: https://www.uwasa.fi/en/education/masters-programmes

13. Master's Degree Programme in Computer Science — Cyber Security
    - Official page: https://www.uwasa.fi/en/education/masters-programmes/computer-science
    - Language: English (verified on official page)
    - Tuition: Not confirmed from official page at time of research

## Data Source Entry (post-merge)

For each merged program, add a data source in the admin UI:
- source_type: official_university
- confidence_level: high
- is_primary_source: true
- URL: the official programme page listed above

## Scholarships — Excluded

Finnish government scholarships for master's students do not exist per studyinfinland.fi.
University-specific scholarship pages were not reachable at time of research.
Scholarships are excluded from this phase.
