# Muntaqā Kanz al-Atfāl — Islamic Creed Learning App

A progressive web app (PWA) for studying Islamic creed through question-and-answer flashcards, built around two educational texts: *Muntaqā Kanz al-Aṭfāl* (a concise summary) and *Kanz al-Aṭfāl* (the full book), both by Dr. Fayṣal bnu Misfir al-Wādiʿī. The app currently offers the Arabic text of both books and the English translation of the full *Kanz*, with more translations planned.

---

## Content

The app contains over 1,500 questions and answers across 18 chapters, covering the pillars of faith, the names and attributes of Allāh, the prophets, the companions, the Qurʾān and its sciences, Islamic jurisprudence, biography of the Prophet ﷺ, etiquettes of daily life, and more. The *Muntaqā* edition (308 questions) includes a recorded audio recitation for every single question and answer.

---

## Browse & Search

- Questions are organized into chapters and presented as interactive flip cards — tap a card to reveal the answer with a smooth 3D animation.  
- The full list loads progressively so even the largest book feels instant.  
- A search bar lets you find any question or answer in seconds, with fuzzy Arabic matching that handles spelling variations and strips diacritics automatically.  
- Search results highlight the matched text and auto-flip cards to the answer face when the match is found there.  
- You can filter by chapter at any time, both in the main view and inside search.

---

## Favorites

- Any card can be starred and saved to a personal favorites list, which persists across sessions.  
- The favorites view gives you quick access to the questions you want to revisit most.

---

## Quiz — Four Modes

The quiz section lets you test yourself on any chapter or the full book, with 5, 10, or 20 questions at a time. Four distinct modes keep practice engaging:

1. **Multiple Choice** — read the question and pick the correct answer from four options.  
2. **Build the Answer** — the answer is split into shuffled word tiles; tap them in the right order to reconstruct it. Placed tiles can be tapped again to return them to the pool.  
3. **Fill in the Blank** — the answer is shown with its most meaningful word hidden; choose the correct word from four options.  
4. **Listen and Identify** — the audio recording plays and you identify the correct answer from four choices, training your ear alongside your memory.  

- The app tracks your performance automatically.  
- Any question you get wrong more often than right gets flagged as a weak spot, and a dedicated *Weak Spots* section appears in the chapter selector so you can drill exactly what needs work.

---

## Audio

- Every question in the *Muntaqā* edition has a native-quality audio recording.  
- Audio plays on both the front and back of flip cards, synced across both faces.  
- Audio also plays during the Listen quiz mode.  
- The app caches all 308 audio files in the background after the first visit, so they play offline without any delay.

---

## Share

- Each card's back face has two sharing buttons:  
  - **Copy** — puts the question and answer text on your clipboard in one tap.  
  - **Share as Image** — generates a polished 1080×1080 card image with question, answer, chapter label, question number, gold ornaments, and app URL as a watermark; shares via the system share sheet on mobile or downloads on desktop.  
- The settings panel also has a **share-link** button that copies (or shares) a deep link to the current content and chapter.

---

## Multilingual & Adaptable

- Fully multilingual: switching between Arabic and English flips the entire interface — text direction, font stack, number format, button labels, chapter names, quiz feedback messages, and the about page all update instantly.  
- Arabic interface uses **Amiri** and **Tajawal** fonts with right-to-left layout.  
- English interface switches to a Latin font stack with left-to-right layout.  
- Adding a new language requires only a single JSON file — no code changes.

---

## Settings

- A settings panel (gear icon) gives three controls:  
  - **Font size:** small, medium, large  
  - **High contrast mode** for better readability in bright light  
  - **Share-link** button  
- Font size and contrast preference are saved and restored automatically on every visit.

---

## Offline & Installable

- Full PWA: works entirely offline after the first visit — all app files and audio are cached by a service worker.  
- Installable to home screen on any device (iPhone, Android, desktop) and opens like a native app.  
- App shell updates silently in the background; users always get the latest version on next normal refresh.  
- No accounts. No ads. No tracking. Completely free.