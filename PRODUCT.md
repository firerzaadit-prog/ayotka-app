# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two primary audiences, each with their own screens:

- **Siswa (students)**, jenjang SD & SMP, preparing for Tes Kemampuan Akademik (TKA) — take timed try-out exams and read per-competency results to know exactly what to restudy next, instead of just a final score.
- **Guru & Sekolah (teachers/schools)**, via the admin_sekolah role — monitor a whole class at once to see which students are weak in which materi.

Secondary roles with their own portals: admin_pusat (AyoTKA's own central/platform admin), dinas_pendidikan (education office, read-only cross-school view of TKA readiness), and mitra (partner/reseller who sells voucher codes and sees only aggregate redemption counts, never student identities).

## Product Purpose

AyoTKA (ayotka.id) is a Tes Kemampuan Akademik (TKA) exam-prep platform for SD & SMP students in Indonesia. It runs try-out exams built to the official Kerangka Asesmen (Kemendikdasmen assessment framework) and turns each result into a per-materi competency map via learning analytics, rather than a single final score. Success for a student is knowing precisely which materi to restudy; success for a teacher/school is seeing at a glance where a whole class is weak.

## Positioning

Generic "Simulasi Kemendikdasmen" sites can match the official framework and question format, but stop at a final score. AyoTKA's meaningfully different mechanism is turning every try-out attempt into a competency map per materi (e.g. Bilangan, Aljabar & Pola, Geometri for Matematika), with saved attempt history, automatic next-material recommendations, and a single screen where a teacher sees an entire class's competency gaps at once — none of which the generic simulations offer.

## Operating Context

- Students take timed try-out attempts per subject/paket, either assigned by their school (jalur sekolah — jadwal ujian) or self-selected (jalur mandiri).
- Every finished/expired attempt automatically triggers an AI (Gemini) analysis producing a strengths/weaknesses narrative and 3–5 sub-materi recommendations, referenced against the official Kerangka Asesmen.
- Schools enroll students via admin_sekolah (bulk import, claim codes) or students self-register (jalur mandiri) and pick or create their school.
- Three payment paths exist, deliberately not unified into one checkout flow: individual students pay via Midtrans (monthly/semester plans, with one free try-out per subject before paying), schools pay via manual bank transfer with admin_pusat activating a seat quota, and partners/resellers (mitra) sell voucher codes redeemed directly for access.
- Subjects currently covered: Matematika, Bahasa Indonesia, IPA, Bahasa Inggris, across SD and SMP jenjang.
- Contact: ayotka.id, (0341) 551312 (Malang, Jawa Timur).

## Capabilities and Constraints

- Try-out questions must stay format-matched to the real TKA question types (pilihan ganda, pilihan ganda kompleks, pilihan ganda kategori) and scored against the actual Kerangka Asesmen structure — this is a hard constraint, not a style choice.
- Roles are strictly separated with their own login portals and RBAC: siswa, admin_sekolah, admin_pusat, dinas_pendidikan, mitra. Mitra never sees a student's NISN or full name, only aggregate voucher usage.
- Student login uses NISN + PIN (school-issued) for jalur sekolah, or self-registered email/password for jalur mandiri — not a generic email-only flow.
- Undecided: exact scope/timeline for extending the flexible Kompetensi schema and the AI-generated question pipeline to IPA and Bahasa Inggris SMP — their official Kerangka Asesmen has not yet been received from Kemendikdasmen/client.

## Brand Commitments

- Name: AyoTKA (domain ayotka.id). Logo assets exist at `public/logo.png` and `public/logo-mark.png`.
- Landing page voice is direct and concrete — it leads with a real-looking 68/100 score example broken into competency bars, showing the mechanism rather than just claiming it in marketing copy.

## Evidence on Hand

None yet — AyoTKA is pre-launch/pilot stage (confirmed with the user during init). No real school partnerships, user counts, or testimonials exist to cite. Future work must not fabricate case studies, customer names, or usage numbers.

## Product Principles

- Show the mechanism, don't just claim it — product previews (real-looking score/competency cards) over abstract marketing copy.
- Every score is a map, never a bare number — the per-materi breakdown is the product's core differentiator and must stay visible everywhere a score appears (siswa web view and PDF rapor alike).
- Payment paths stay separate by design — individual, school, and partner flows solve different trust/liability problems and should not be collapsed into one generic checkout for simplicity's sake.
- Privacy boundaries are structural, not incidental — a role only sees what its job requires (e.g. mitra never sees student identities; dinas_pendidikan is read-only).
- Match official structure exactly — question formats and the assessment framework follow Kemendikdasmen's real Kerangka Asesmen, not an approximation of it.

## Accessibility & Inclusion

No accessibility standard has been formally established yet (confirmed with the user during init) — undecided rather than absent by oversight.
