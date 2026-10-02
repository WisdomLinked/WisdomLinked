import type { Guide } from './types';

export const mockGuides: Guide[] = [
  {
    id: 'guide-grad-school',
    slug: 'graduate-school-guide',
    title: 'Graduate School Guide',
    description: 'Everything you need to know about applying to grad school — from choosing a program to letters of recommendation.',
    icon: 'graduation',
    order: 0,
    published: true,
    sections: [
      {
        id: 'choosing-a-program',
        title: 'Choosing a Program',
        order: 0,
        content: `A strong application starts with a short, honest list of programs — not a spreadsheet of every ranking you can find.

**Fit beats prestige.** Look for faculty whose current work matches the questions you want to study, not only a department’s overall brand. Read two or three recent papers from potential advisors and note whether you could imagine contributing to that lab or group.

**Ask practical questions:**
- Does the program fund students in year one, or only after a qualifying exam?
- Are there required rotations, a thesis, or a course-heavy first year?
- What do recent graduates do — academia, industry, national labs?

Talk with current students if you can. They will tell you how advising actually works, how heavy teaching duties are, and whether the culture is collaborative or competitive. Aim for a balanced list: a few ambitious reaches, several realistic matches, and at least one program you would be glad to attend.

If you are applying from outside the country you hope to study in, confirm language requirements, visa timelines, and whether the department has supported international students through funding gaps.`,
      },
      {
        id: 'building-a-strong-sop',
        title: 'Building a Strong SOP',
        order: 1,
        content: `Your statement of purpose should read like a research conversation, not a childhood autobiography.

Open with the problem you want to work on and why it matters. Then show the path that prepared you: a thesis, a paper, an internship, or a course sequence that changed how you think. Be specific — “I analyzed delay at a signalized intersection using two months of detector data” is stronger than “I am passionate about transportation.”

**Keep the structure tight:**
- What you want to study, in one or two sentences
- Evidence that you can do that work (methods, results, tools)
- Why this department — name two or three faculty and how your interests overlap
- What you hope to do after the degree, without over-promising

Cut clichés, avoid ranking the school, and do not recycle a generic essay with the university name swapped in. Have a mentor who knows the field read a draft. If English is not your first language, get a native-level edit for clarity, not for a fancier vocabulary.

Most programs give you 500–1,000 words. Use them. A short, concrete SOP almost always beats a long, vague one.`,
      },
      {
        id: 'requesting-letters',
        title: 'Requesting Letters of Recommendation',
        order: 2,
        content: `Letters work when the writer can describe your work, not just your grade.

Ask people who supervised research, a thesis, or a substantial project. A famous name who barely knows you is weaker than a lecturer who watched you debug a model for a semester. Ask **at least six weeks** before the first deadline, and give them an easy out: “If you do not feel you can write a strong letter, I completely understand.”

**When they say yes, send a single packet:**
- Your CV and unofficial transcript
- A short paragraph on each program and why you are applying
- Bullet points they might forget (your role on a paper, a presentation, a method you owned)
- A table of deadlines and how to submit

Remind them ten days before each due date. After it is submitted, send a thank-you and later tell them where you landed. Faculty remember students who close the loop, and you may need another letter next year.`,
      },
      {
        id: 'timeline-and-funding',
        title: 'Timeline and Funding',
        order: 3,
        content: `Treat applications as a six-month project, not a December scramble.

**A workable calendar:**
- **Spring / early summer:** shortlist programs, email potential advisors with a focused note and CV, start GRE/TOEFL only if a program still requires them
- **Late summer:** SOP outline, ask letter writers, order transcripts
- **Early fall:** SOP drafts, faculty conversations, scholarship applications that share the same essay
- **November–January:** submit; many STEM deadlines cluster here
- **February–April:** interviews, visits, and funding offers

Funding is part of the offer, not a detail to check later. Compare stipend versus local rent, health insurance, summer support, and whether tuition is fully covered. If an offer is unfunded or only guaranteed for one year, ask the graduate coordinator what typical students actually receive.

For a broader overview of graduate funding in the U.S., see [Federal Student Aid](https://studentaid.gov/). International applicants should also map embassy appointment wait times onto this calendar so a late visa does not erase a funded offer.`,
      },
    ],
  },
  {
    id: 'guide-scholarships',
    slug: 'scholarship-guide',
    title: 'Scholarship Guide',
    description: 'How to find awards that fit your profile, write a competitive application, and avoid the mistakes that get strong candidates skipped.',
    icon: 'award',
    order: 1,
    published: true,
    sections: [
      {
        id: 'finding-scholarships',
        title: 'Finding Scholarships',
        order: 0,
        content: `The awards you are most likely to win are rarely the ones on a generic “top 50 scholarships” list.

Start with **restricted pools**: your university, department, professional society, employer, home-country ministry, and community organizations. A $4,000 award with 40 applicants is often more realistic than a $40,000 award with 4,000.

**Search with constraints, not keywords alone:**
- Citizenship, visa status, and where you will study
- Field of study and career goal (research, teaching, public service)
- Need-based versus merit-based
- Whether the award can be combined with a research assistantship

Use official portals and societies, not paid “we will find scholarships for you” services. Bookmark deadlines in one calendar. For U.S. federal aid and some grant searches, start at [StudentAid.gov](https://studentaid.gov/). Ask your current department’s coordinator which awards last year’s students actually received — that list is worth more than a blog post.

Revisit the search every term. New departmental awards appear quietly, and some fellowships open only once you are already enrolled.`,
      },
      {
        id: 'writing-a-winning-application',
        title: 'Writing a Winning Application',
        order: 1,
        content: `Committees read quickly. They are looking for a clear story: who you are, what you will do with the money, and why their mission matches yours.

Answer the prompt you were given. If they ask how you will serve your community after the degree, do not paste your research SOP. If they ask for a budget, make the numbers add up and explain each line.

**A clean application usually includes:**
- A one-page narrative with a specific plan (coursework, research, internship) and a realistic timeline
- Evidence: a paper, a project, a leadership role, or grades in the relevant sequence — not a list of every club
- A budget that matches the award’s allowed costs
- Recommenders who can speak to the same story you told

Name the award in the first paragraph so the reader knows you did not send a mass email. Keep formatting simple: readable font, consistent headings, no dense blocks of text. Have someone outside your field read it; if they cannot explain your plan back to you, rewrite it.`,
      },
      {
        id: 'common-mistakes',
        title: 'Common Mistakes to Avoid',
        order: 2,
        content: `Most rejected applications are incomplete or off-mission, not “not smart enough.”

**Watch for these:**
- Missing a required transcript, signature, or eligibility checkbox
- Writing a research SOP for a leadership or public-service award
- Inflating titles (“led a lab” when you ran one experiment)
- Asking a recommender three days before the deadline
- Ignoring word limits or uploading the wrong file
- Applying to awards that exclude your visa type or degree level

Do not pay a consultant who guarantees a win. Do not copy essays from the internet — committees notice, and so do plagiarism checkers. If you are waitlisted, a short, factual update (a new paper, a new grade, a competing offer) is appropriate; a long emotional appeal is not.

When you are unsure whether you are eligible, email the listed contact with one paragraph and your CV. Guessing and submitting anyway wastes their time and yours.`,
      },
      {
        id: 'after-you-submit',
        title: 'After You Submit',
        order: 3,
        content: `Submission is not the end of the process.

Confirm that recommenders and portals show “received.” Save PDFs of everything you uploaded. If the award interviews finalists, prepare a two-minute version of your plan and three questions about the program’s expectations (reporting, internships, return-of-service).

**If you win:** read the terms before you celebrate in public. Some awards cannot be combined with a full research assistantship; some require you to stay in a country or sector for a set period. Tell your department immediately so they can adjust your funding package.

**If you do not win:** ask whether feedback is offered. Revise the essay while the committee’s language is still in your head, and reuse a stronger draft on the next cycle. Many students win on the second or third try with the same core story and a tighter fit.

Keep a simple tracker of awards, dates, and outcomes. Next year’s you will thank you.`,
      },
    ],
  },
];
