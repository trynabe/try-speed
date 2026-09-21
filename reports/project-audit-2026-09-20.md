# รายงานตรวจสอบ Try-Speed
วันที่ตรวจ: 20 กันยายน 2026 • Commit ที่ตรวจ: 9fcff03

ตรวจ source, styles, markup, README และ tests ครบ 14 ไฟล์ ไม่รวมข้อมูลภายใน .git ตรวจทุกฟังก์ชันใน JavaScript 7 โมดูลด้วยการอ่านโค้ด และทดสอบเส้นทางสำคัญด้วย Node กับเบราว์เซอร์ ไม่ได้หมายความว่าทดสอบทุกชุดข้อมูลหรือทุกเบราว์เซอร์แล้ว

**ผลสำคัญ:** โครงสร้างโมดูลเข้าใจง่าย และ tests เดิมผ่าน 44 assertions แต่มีบั๊กสำคัญที่ทำให้พิมพ์ต่อหลังหมดเวลา บันทึกผลซ้ำ และสร้าง personal best ผิดได้ ควรแก้ lifecycle ของ session ก่อนเพิ่มฟีเจอร์

## 1. โครงสร้างโปรเจกต์

    project try-speed/
    ├── index.html
    ├── README.md
    ├── css/
    │   ├── main.css
    │   ├── typing.css
    │   └── components.css
    ├── js/
    │   ├── app.js
    │   ├── typing-engine.js
    │   ├── timer.js
    │   ├── text-generator.js
    │   ├── storage.js
    │   ├── audio.js
    │   └── ui.js
    └── tests/
        ├── test_engine.js
        └── test_suite.js

เป็น static web app ใช้ HTML/CSS และ JavaScript ES modules ไม่มี framework, backend, database server หรือ build pipeline ใน repository นี้ ข้อมูลผู้ใช้เก็บใน localStorage และเสียงสร้างด้วย Web Audio API หรือไฟล์ที่ผู้ใช้เลือก มี dependency ภายนอกสำหรับ Google Fonts พร้อม system-font fallback

| ไฟล์ | บรรทัด | หน้าที่ |
|---|---:|---|
| [index.html](</C:/Users/itstr/OneDrive/Desktop/project try-speed/index.html>) | 628 | หน้าฝึกพิมพ์, settings, สถิติ และ modal 6 ชุด |
| [app.js](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/app.js>) | 694 | สร้างโมดูล, ผูก events, จัดการ settings และวงจร session |
| [typing-engine.js](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/typing-engine.js>) | 180 | ตรวจอักษร, backspace, นับคะแนนและ completion |
| [timer.js](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/timer.js>) | 71 | countdown/count-up, tick ทุก 100 ms |
| [text-generator.js](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/text-generator.js>) | 153 | คลังคำ 3 ระดับ, shuffle, สร้างข้อความตามเวลา |
| [storage.js](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/storage.js>) | 178 | preferences, recent history 100 รายการ, personal best |
| [audio.js](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/audio.js>) | 354 | เสียง 5 profiles, custom audio, volume/mute, finish chime |
| [ui.js](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/ui.js>) | 482 | DOM, character states, caret, modal, themes, history |
| [main.css](</C:/Users/itstr/OneDrive/Desktop/project try-speed/css/main.css>) | 405 | theme 8 แบบ, typography, page/header/footer |
| [typing.css](</C:/Users/itstr/OneDrive/Desktop/project try-speed/css/typing.css>) | 212 | typing arena, hidden input, caret, character feedback |
| [components.css](</C:/Users/itstr/OneDrive/Desktop/project try-speed/css/components.css>) | 844 | controls, statistics, buttons, modals และ responsive rules |
| [test_engine.js](</C:/Users/itstr/OneDrive/Desktop/project try-speed/tests/test_engine.js>) | 86 | unit assertions ของ generator/engine |
| [test_suite.js](</C:/Users/itstr/OneDrive/Desktop/project try-speed/tests/test_suite.js>) | 148 | assertions เพิ่มสำหรับ deletion/scoring/inf/audio setters |
| [README.md](</C:/Users/itstr/OneDrive/Desktop/project try-speed/README.md>) | 63 | ฟีเจอร์ วิธีเปิดเว็บและรันทดสอบ |

เส้นทางหลัก: index → app → โหลด settings → ตั้ง UI/audio/timer/engine → generateText → renderText → รับ key/input → engine → UI; ตัวอักษรแรกเริ่ม timer และ tick ส่ง elapsed เข้า engine; เมื่อหมดเวลาหรือข้อความหมด app บันทึก session แล้วเปิดผลลัพธ์

จุดที่ทำได้ดี: engine/timer/generator แยกจาก DOM, callbacks แยก metrics ออกจาก character rendering, UI cache ตำแหน่งตัวอักษรเพื่อลดการอ่าน layout ทุก key, และมีการจำกัด recent history

## 2. ข้อบกพร่องที่ควรแก้ตามลำดับ

P1 = กระทบความถูกต้องของผลหลัก ควรแก้ก่อน release; P2 = ฟีเจอร์หรือการใช้งานผิดในเงื่อนไขที่ระบุ; P3 = ความทนทาน รายละเอียด UI หรือเอกสาร

### F01 — P1: หมดเวลาแล้ว engine ยังรับ input และบันทึกผลซ้ำได้

**ตำแหน่ง:** [app.js:659](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/app.js:659>), timeout callback ที่บรรทัด 37 และ engine-completion callback ที่บรรทัด 54

finishSession() ไม่ล็อก engine หรือป้องกันการเรียกซ้ำ เมื่อ countdown หมด timer หยุด แต่ engine.isCompleted ยังเป็น false หากข้อความยังไม่หมด และ results modal ยังปล่อย focus ไว้ที่ hidden-input

**ยืนยันในเบราว์เซอร์:** ตั้ง 1 วินาที พิมพ์ผิดหนึ่งตัว รอผลลัพธ์ แล้วกดอีกตัว → live incorrect เปลี่ยนจาก 1 เป็น 2 แต่ผลใน modal ยังเป็น 1

**ยืนยันด้วย integration probe:** ใช้ app/engine/timer/generator/storage จริงร่วมกับ DOM/UI/clock/storage mocks: ข้อความทดสอบยาว 140 ตัว พิมพ์ผิดหนึ่งตัวและหมดเวลาที่ 1 วินาที จากนั้นพิมพ์อีก 139 ตัวให้ครบ → history เพิ่มจาก 1 เป็น 2 รายการ ผลใหม่เป็น 1,668 WPM โดย timeSpent ยัง 1 วินาที และเปลี่ยน best score

**แนวแก้:** มีสถานะ session ที่ชัดเจนและจบได้ครั้งเดียว ปิดรับ input ณ deadline อัปเดตเวลาสุดท้ายก่อนคิดคะแนน แล้วบันทึกเพียงครั้งเดียว

### F02 — P2: ปุ่มลัด restart และ focus ของ modal ทำให้เริ่มพิมพ์หลังหน้าต่างที่ยังเปิดอยู่

**ตำแหน่ง:** [app.js:288](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/app.js:288>), [app.js:649](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/app.js:649>), [ui.js:298](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/ui.js:298>), [ui.js:351](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/ui.js:351>)

Ctrl+Enter เรียก restartCurrentText() โดยไม่ปิด results modal; Tab→Enter ภายใน 900 ms ถูกมองว่าเป็น restart ทุกตำแหน่ง รวมถึงการ Tab ไปกดปุ่ม settings ตามปกติ การเปิด modal มีเพียงการสลับ class จึงไม่ย้าย/จำกัด/คืน focus และไม่ปิด controls ด้านหลัง

**ยืนยันในเบราว์เซอร์:** Ctrl+Enter จากผลลัพธ์ทำให้เวลาและตัวนับ reset แต่ผลลัพธ์ยังเปิด; เปิด Custom แล้ว Tab→Enter ทำให้ focus ย้ายกลับ hidden-input ขณะ Custom modal ยังเปิด

**แนวแก้:** กำหนดพฤติกรรม restart ตอนเปิด modal ให้ชัด จำกัด shortcut ตาม context และจัดการ focus พร้อมป้องกัน background interaction

### F03 — P2: โหมด inf จบเมื่อข้อความหมด

**ตำแหน่ง:** [text-generator.js:110](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/text-generator.js:110>), [typing-engine.js:90](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/typing-engine.js:90>), [app.js:54](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/app.js:54>)

inf สร้างข้อความเพียง 240 entries จาก word pool แล้วใช้ completion เหมือนโหมดปกติ คำบาง entry ใน hard มีหลายคำย่อย จึงไม่ควรตีความว่าเป็น 240 whitespace-separated words ทุก difficulty

**หลักฐาน:** generateText('easy','inf') ได้ 240 คำ เมื่อส่งข้อความครบ engine.isCompleted เป็น true และ app หยุด timer ซึ่งไม่ตรงกับ unlimited/endless practice ใน UI

**แนวแก้:** เติมข้อความเมื่อใกล้หมด และมีวิธีจบ session ด้วยตัวเองสำหรับโหมดนี้

### F04 — P2: เวลาที่ใช้คิดคะแนนกับเวลาที่บันทึกไม่ตรงกัน

**ตำแหน่ง:** [timer.js:31](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/timer.js:31>), [timer.js:68](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/timer.js:68>), [app.js:659](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/app.js:659>)

tick สุดท้ายส่ง elapsed ที่อาจเกิน duration เข้า engine ก่อน onComplete(totalDuration) แต่ finishSession() อ่านคะแนนที่คำนวณแล้วโดยไม่ปรับ elapsed ให้ตรงกัน นอกจากนี้ early finish ใช้ elapsed ของ tick ล่าสุดแทน timestamp ขณะจบ

**หลักฐานจาก deterministic clock:** รอบ 30 วินาที พิมพ์ถูก 100 ตัว แล้ว final callback ทำงานที่ 31 วินาที → ได้ 39 WPM แต่บันทึก timeSpent=30; หากคิดจาก 30 วินาทีควรเป็น 40 WPM

**แนวแก้:** ใช้ monotonic clock คำนวณเวลาสุดท้าย clamp countdown ที่ deadline และส่งค่าเดียวกันให้ engine กับ sessionData

### F05 — P2: Composition input ถูกนับซ้ำก่อนยืนยันข้อความ

**ตำแหน่ง:** [app.js:564](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/app.js:564>), [app.js:572](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/app.js:572>)

ไม่มีการแยก isComposing หรือ insertCompositionText; handleMobileInput() ส่ง e.data ทั้งก้อนเข้า engine ทุกครั้ง แม้เป็นการแทนข้อความระหว่าง composition

**หลักฐานระดับ handler:** ส่ง updates 'a', 'ab', 'abc' โดย isComposing=true → นับ 6 ตัวก่อน commit แทนการรอข้อความสุดท้าย อีกกรณี keydown ที่ isComposing=true ก็นับตัวอักษรทันที

**แนวแก้:** กำหนด input pipeline ที่รองรับ composition/commit/replacement และ deduplicate จาก event จริง แทนเวลา 40 ms อย่างเดียว ข้อนี้ยืนยันด้วย controlled events ยังไม่ได้ทดสอบ IME บนอุปกรณ์จริง

### F06 — P2: Controls หลุดขอบหน้าจอ 320 พิกเซล

**ตำแหน่ง:** [main.css:270](</C:/Users/itstr/OneDrive/Desktop/project try-speed/css/main.css:270>), [main.css:317](</C:/Users/itstr/OneDrive/Desktop/project try-speed/css/main.css:317>), [components.css:17](</C:/Users/itstr/OneDrive/Desktop/project try-speed/css/components.css:17>)

header/actions และ control-group ไม่จัดบรรทัดใหม่ในพื้นที่แคบ ขณะที่ body ซ่อน overflow แนวนอน

**หลักฐานจากเบราว์เซอร์ที่ 320×700:** ปุ่ม Theme อยู่ x≈342 ถึง 379 จึงอยู่นอก viewport ทั้งปุ่ม, Sound ถูกตัดบางส่วน, Custom ยื่นไปถึง x≈335 และ Hard ถูกตัดด้วย ทดสอบ 390×844 แล้วเห็น controls หลัก แต่ชื่อแบรนด์ขึ้นสองบรรทัด

**แนวแก้:** เพิ่ม layout สำหรับหน้าจอแคบที่จัด header/actions และ settings ได้ครบ ทดสอบอีกครั้งเมื่อ badge มีข้อความ personal best ยาว

### F07 — P2: Keyboard และ screen reader ใช้ตัวเลือกได้ไม่ครบ/อ่านสถานะผิด

**ตำแหน่ง:** [index.html:373](</C:/Users/itstr/OneDrive/Desktop/project try-speed/index.html:373>), [index.html:512](</C:/Users/itstr/OneDrive/Desktop/project try-speed/index.html:512>), [app.js:620](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/app.js:620>), [ui.js:383](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/ui.js:383>)

Theme/Sound cards เป็น div รับ click อย่างเดียว จึง Tab ไปเลือกไม่ได้; duration/difficulty ปรับเฉพาะ class ไม่อัปเดต aria-checked

**ยืนยันจาก DOM ในเบราว์เซอร์:** sound cards มี tabIndex=-1; หลังเลือก 30s ปุ่ม 30s active แต่ aria-checked=false และ 60s ยัง aria-checked=true

**แนวแก้:** ใช้ button/radio ที่รองรับ keyboard พร้อม selected state และอัปเดต accessibility state ทุกครั้งที่เปลี่ยน settings

### F08 — P2: Custom background สีอ่อนทำให้ข้อความหลักอ่านยากมาก

**ตำแหน่ง:** [ui.js:397](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/ui.js:397>), [main.css:13](</C:/Users/itstr/OneDrive/Desktop/project try-speed/css/main.css:13>)

setTheme('custom') เปลี่ยนพื้นหลัง/accent แต่ไม่ได้กำหนด text/surface/border ให้เข้ากัน การเลือกพื้นหลัง #ffffff จึงยังใช้ --text-main=#f0f2f5 จาก default dark แม้เริ่มจาก Light theme

**หลักฐานจากโค้ดและค่าสี:** ตัวอักษรเกือบขาวบนพื้นขาวมี contrast ประมาณ 1.12:1 ข้อนี้ตรวจจาก style logic ไม่ได้ทดสอบ native color picker ครบทุกแบบ

**แนวแก้:** คำนวณชุดสีข้อความที่อ่านได้ตามพื้นหลัง หรือให้กำหนดสีข้อความและแสดงตัวอย่างก่อนใช้

### F09 — P2: เปลี่ยน custom audio เป็นไฟล์ใหญ่แล้ว reload กลับไปใช้ไฟล์เก่า

**ตำแหน่ง:** [audio.js:52](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/audio.js:52>)

รับและเล่นไฟล์ใหม่ได้ แต่ cache เฉพาะขนาดต่ำกว่า 3.5 MiB ถ้าไฟล์ใหม่ใหญ่กว่านั้นจะไม่แก้ cache เก่า และยังรายงานการโหลดสำเร็จ

**หลักฐานจาก AudioContext/localStorage mocks:** โหลด old-click.wav แล้ว replacement.wav ขนาด 4 MiB → active filename เป็น replacement.wav แต่ stored filename ยัง old-click.wav การ restore จึงกลับไปไฟล์เดิม

**แนวแก้:** กำหนดขนาดที่รองรับให้ชัด แยกสถานะโหลดกับบันทึก และจัดการ cache เก่าเมื่อเปลี่ยนไฟล์ไม่สำเร็จ หรือใช้ IndexedDB

### F10 — P2: Mute/Volume ไม่ควบคุม custom audio ที่กำลังเล่น

**ตำแหน่ง:** [audio.js:227](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/audio.js:227>), [audio.js:325](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/audio.js:325>)

ทุก key สร้าง source ใหม่และเล่นไฟล์ทั้งก้อน ไม่มีการเก็บ source เพื่อหยุดหรือ master gain กลาง; mute เปลี่ยน boolean และ volume เปลี่ยนตัวแปรที่ใช้กับเสียงครั้งถัดไป

**หลักฐานจาก AudioContext mock:** buffer ยาว 120 วินาที กดสามครั้งแล้ว mute → start(0) สามครั้ง ไม่มี stop หรือการปรับ gain ของเสียงเดิม

**แนวแก้:** ใช้ master gain ที่ควบคุมทุกเสียง พร้อมจำกัดความยาว/จำนวน custom sounds ที่เล่นซ้อนกัน

### F11 — P2: Restore custom audio แล้ว UI ไม่อัปเดตชื่อไฟล์

**ตำแหน่ง:** [audio.js:32](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/audio.js:32>), [app.js:26](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/app.js:26>)

restore เริ่มหลัง 100 ms และ decode แบบ async แต่ app อ่านชื่อไฟล์เพื่อ render ทันที ไม่มี callback หรือ refresh เมื่อเปิด modal

**หลักฐานจาก mock:** ตอนสร้าง app ชื่อเป็นค่าว่าง ต่อมา restore ได้ชื่อจริงแล้วแต่ UI ไม่มีการอัปเดต จึงยังแสดงข้อความ upload/placeholder จนกดเลือก profile อีกครั้ง ปัญหา F12 ทำให้ badge ที่ตั้งใจซ่อนยังแสดงอยู่ด้วย

**แนวแก้:** ให้ initialization คืน promise/event แล้ว sync UI เมื่อโหลดเสร็จและเมื่อเปิด modal

### F12 — P3: Badge custom audio แสดงแม้ยังไม่มีไฟล์

**ตำแหน่ง:** [index.html:547](</C:/Users/itstr/OneDrive/Desktop/project try-speed/index.html:547>), [ui.js:449](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/ui.js:449>)

ใช้ class hidden กับ custom-file-status แต่ CSS ไม่มี generic .hidden; มีเฉพาะ selectors สำหรับ modal, overlay และ new-best

**ยืนยันในเบราว์เซอร์:** custom-file-status มี class=hidden แต่ computed display=block และแสดง custom_sound.mp3 ใน profile ที่ไม่ได้อัปโหลดเสียง

**แนวแก้:** ใช้ hidden attribute หรือกำหนด CSS hiding rule ให้ตรงกับ element

### F13 — P3: Custom duration ยอมรับข้อมูลที่ไม่ใช่จำนวนเต็มทั้งค่า

**ตำแหน่ง:** [app.js:524](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/app.js:524>)

parseInt() ยอมรับส่วนต้น เช่น '30abc' กลายเป็น 30; ค่าผิดอื่นถูกแทนเป็น 60 และปิด modal โดยไม่อธิบาย ข้อมูลเกิน 3600 ถูกลดลงเงียบ ๆ

**ยืนยันในเบราว์เซอร์:** กรอก 30abc แล้ว Save → modal ปิดและ timer เป็น 0:30

**แนวแก้:** ตรวจทั้งค่า แสดง validation error และบอกช่วง 1–3600 วินาทีกับ inf ก่อนบันทึก

### F14 — P3: JSON ถูก syntax แต่ผิด schema ทำให้ storage ใช้ต่อไม่ได้

**ตำแหน่ง:** [storage.js:48](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/storage.js:48>), [storage.js:125](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/storage.js:125>)

getHistory()/getAllBestScores() parse JSON แต่ไม่ตรวจ shape

**หลักฐานจาก in-memory storage:** history='null' ทำให้ getSummaryStats() throw และ saveSession() คืน null; best_scores='null' ทำให้ getBestScore() throw ระหว่างเริ่ม app นี่เป็นกรณีจำลองข้อมูลเสีย ไม่ใช่ข้อมูลที่ UI ปกติสร้าง

**แนวแก้:** validate array/object/field types และ recover หรือ migrate ก่อนใช้ รวมถึงตรวจ settings ที่โหลดกลับมา

### F15 — P3: ตัวป้องกันคำติดกันซ้ำยังพลาดที่ท้าย pool

**ตำแหน่ง:** [text-generator.js:134](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/text-generator.js:134>)

ถ้าคำซ้ำเป็น entry สุดท้ายของ shuffled pool จะไม่มี fallback เลือกใหม่

**หลักฐาน deterministic:** ใช้ LCG seed 11344, state=(1664525*state+1013904223)>>>0, random=state/4294967296 แล้ว generateText('medium',120) → token 166/167 เป็น twilight twilight

**แนวแก้:** เลือกใหม่เมื่อซ้ำโดยจัดการการข้าม pool ให้ครบ

## 3. ข้อสังเกตด้านความหมาย เอกสาร และการดูแลโค้ด

- **Summary เป็น 100 sessions ล่าสุด:** [storage.js:144](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/storage.js:144>) ใช้เฉพาะ history ที่ยังเหลือ ดังนั้น Total Tests ไม่เกิน 100 และ Highest WPM อาจไม่เท่ากับ best badge ที่เก็บระยะยาว ตัวอย่าง 200 WPM หนึ่งครั้งตามด้วย 50 WPM อีก 100 ครั้ง → summary highest=50 แต่ best=200 ควรระบุช่วงข้อมูลให้ชัด หรือเก็บ lifetime aggregates แยก ถ้าเจตนาคือ lifetime stats
- **วิธีเปิดไฟล์โดยตรงใน README ไม่เหมาะกับ ES modules:** [README.md:43](</C:/Users/itstr/OneDrive/Desktop/project try-speed/README.md:43>) ควรกำหนดให้ serve ผ่าน HTTP; การตรวจครั้งนี้ยืนยันการเปิดผ่าน HTTP เท่านั้น ส่วนคำสั่ง npx serve . ไม่ได้ระบุ port 8080 ตาม URL ที่เอกสารให้ต่อท้าย
- **คำอธิบาย Medium ไม่ตรง generator:** README/UI อธิบาย natural sentences/prose แต่ generator สุ่ม word streams พร้อมตัวพิมพ์ใหญ่และ punctuation ไม่ได้ประกอบประโยค
- **นิยามคะแนน:** net WPM ใช้ correct characters ที่ยังอยู่, raw WPM ใช้จำนวน keystrokes สะสม และ accuracy ใช้ correct keystrokes สะสม ดังนั้นลบความผิดแล้ว incorrectChars เป็น 0 ได้แต่ accuracy ยังต่ำกว่า 100% พฤติกรรมนี้ควรระบุให้ผู้ใช้เข้าใจ ไม่ได้จัดเป็นบั๊กโดยอัตโนมัติ
- **การกัน input ซ้ำ 40 ms:** controlled sequence keydown('a') ตามด้วย input('b') หลัง 20 ms ทิ้ง b แม้เป็นคนละตัว เป็นข้อจำกัดที่ควรปรับ แต่ยังไม่ได้ยืนยันว่าเกิดจาก keyboard จริงรุ่นใด
- **Accessibility อื่น:** viewport ปิด user zoom; color pickers, slider และ custom duration input ไม่มี associated label ครบ; ไม่มี reduced-motion rule สำหรับ animations ควรทบทวนพร้อม F02/F07
- **History ของ inf แสดงว่า infs:** [ui.js:342](</C:/Users/itstr/OneDrive/Desktop/project try-speed/js/ui.js:342>) ต่อท้าย s ทุก duration ควรแสดงชื่อโหมดหรือเวลาที่ใช้จริง
- **HTML จาก storage:** renderHistory() ใช้ innerHTML กับ stored fields ปัจจุบันไม่พบเส้นทางรับข้อมูลจากผู้ใช้ภายนอกเข้าสู่ fields เหล่านี้ตาม UI ปกติ จึงเป็นงาน hardening เช่นใช้ textContent/escaping และ schema validation ไม่ใช่ข้อสรุปว่ามี remote XSS
- **Repository setup:** ไม่มี package.json ระบุ Node/ES module configuration, test script หรือ CI ใน repository นี้ Node v24.15.0 ที่ใช้ตรวจรัน tests ได้ ควรกำหนด runtime ที่รองรับและคำสั่งมาตรฐานเพื่อให้ทำซ้ำง่าย
- **Performance:** getMetrics() และ updateCharacterStates() วนตรวจทั้งข้อความ การตั้ง 3600s ทำให้ generator เลือกประมาณ 5940 entries ซึ่งอาจสร้าง spans จำนวนมาก ยังไม่ได้ benchmark จึงไม่จัดเป็นบั๊กที่ยืนยันแล้ว

## 4. รายการฟังก์ชันที่ตรวจครบ

รายการนี้ครอบคลุม named functions/methods รวมถึง constructor; event callbacks ที่อยู่ภายในตรวจร่วมกับเมธอดเจ้าของ

| โมดูล | ฟังก์ชัน | งานที่ตรวจ |
|---|---|---|
| app | constructor | initialization และการเชื่อม callbacks ทั้งหมด |
| app | initEventListeners | key/input/focus, duration, difficulty, controls, history, results, shortcuts, resize |
| app | initSoundModal | enable/profile/volume/preview/upload/delete |
| app | initThemeAndCustomizer | preset/custom color events และ persistence |
| app | applyCustomDurationFromModal | parse/validate/save/close |
| app | handleKeyDown, handleMobileInput | physical keyboard, backspace, mobile input และ deduplication |
| app | focusInput | focus และ overlay |
| app | setDuration, setDifficulty | save settings, update UI/best และ reset |
| app | applyActiveSettingsPills, updateBestScoreBadge | settings selection และ best badge |
| app | loadNewText, restartCurrentText | reset timer/engine และ render |
| app | finishSession | final metrics, history, personal best และ results |
| app | refreshAndOpenHistory | history summary/render/open |
| typing-engine | constructor, setText, reset | initialization/reset ทุก state/counter |
| typing-engine | setElapsedSeconds | metrics-only callback |
| typing-engine | handleInput | correct/error, first key, sounds, completion |
| typing-engine | handleBackspace | character/word deletion |
| typing-engine | getMetrics | net/raw WPM, accuracy, counts, progress |
| timer | constructor, setDuration | countdown/inf และ duration normalization |
| timer | start, stop, reset, getElapsedSeconds | timestamp, interval, lifecycle, callbacks |
| text-generator | shuffle, generateText | shuffle, difficulty selection, text length, duplicate prevention |
| storage | getSettings, saveSettings | defaults, merge, JSON storage |
| storage | getHistory, saveSession | recent session lifecycle และ limit |
| storage | updateBestScore, getAllBestScores, getBestScore | mode/overall best และ accuracy tie-break |
| storage | getSummaryStats, clearHistory | aggregates และการล้าง history/best |
| audio | getContext, initStoredCustomAudio | AudioContext lifecycle และ startup restore |
| audio | loadCustomAudioFile, loadCustomAudioFromBase64, clearCustomAudio | decode/cache/restore/remove |
| audio | playMechanical, playThock, playTypewriter, playPop, playBeep | oscillator/filter/gain envelopes |
| audio | playCustomBuffer, playErrorSound | custom buffer/error feedback |
| audio | playKeyClick, playFinishChime | dispatch, gain, finish audio |
| audio | setMuted, isMuted, setVolume, getVolume | state setters/getters |
| audio | setProfile, getProfile, hasCustomAudio, getCustomAudioName | profile/custom metadata |
| ui | constructor, renderText, measurePositions | DOM references, character spans, geometry cache |
| ui | updateCharacterStates, updateCaretPosition, markTyping | feedback, scrolling, cursor, blink timer |
| ui | updateLiveMetrics, updateTimer, showFocusOverlay, updateBestBadge | live UI |
| ui | showResultsModal, hideResultsModal | result values, badges, visibility |
| ui | renderHistory, openHistoryModal, closeHistoryModal | summaries/list/date formatting/modal |
| ui | openInstructionsModal, closeInstructionsModal | instructions visibility |
| ui | openThemeModal, closeThemeModal, setTheme, adjustColor | theme/custom properties |
| ui | openCustomDurModal, closeCustomDurModal, updateCustomDurationPill | duration modal/label/active state |
| ui | openSoundModal, closeSoundModal, updateSoundProfileUI, updateSoundVolumeUI, setSoundState | sound controls/icon/filename/volume |

คลังคำมี easy 290 entries, medium 168 entries และ hard 100 entries บาง entries มีหลายคำและมี Unicode/punctuation

## 5. สิ่งที่ทดสอบและผล

| การตรวจ | ผล |
|---|---|
| node tests/test_engine.js | 21 passed, 0 failed |
| node tests/test_suite.js | 23 passed, 0 failed |
| node --check สำหรับ JS ทั้ง 7 โมดูลและ tests 2 ไฟล์ | ผ่านทั้งหมด |
| ตรวจ path ของ ES imports และ local script/styles | ไม่พบ path หาย |
| ตรวจ duplicate HTML IDs และ getElementById ที่ไม่ตรง markup | ไม่พบ |
| เปิดเว็บผ่าน Python HTTP server ใน Codex in-app browser | เริ่มใช้งานได้ |
| Console ของหน้า localhost ระหว่างเส้นทางที่ทดสอบ | ไม่พบ error/warn ใน log ที่อ่าน |
| ทดลอง expiry, input หลัง expiry, restart shortcut, modal keyboard, invalid duration, sound badge, ARIA | พบ F01/F02/F07/F12/F13 |
| Responsive 390×844 และ 320×700 | ยืนยัน F06 ที่ 320px |
| Controlled Node probes: session lifecycle, delayed timer, inf, composition, storage, audio | ยืนยันตามหลักฐานแยกในแต่ละ finding |

**ช่องว่างของ tests ปัจจุบัน:** ไม่มี integration/UI tests; ไม่มี countdown expiry/session lock/duplicate-save tests; ไม่มี delayed/early finish scoring tests; ไม่มี inf text-exhaustion tests; ไม่มี storage tests; audio ตรวจเพียง setters/getters จึงไม่ครอบคลุม upload/cache/restore/mute ระหว่างเล่น

ชุด regression ที่ควรเพิ่มหลังแก้: จบรอบเพียงครั้งเดียว, ไม่รับอักษรหลัง deadline, elapsed สอดคล้องคะแนน, inf ต่อข้อความได้, keyboard modal lifecycle, composition commit, storage schema recovery, custom audio replacement/restore/mute และ viewport 320px

**ขอบเขตการยืนยัน:** ทดสอบบน Windows, Node v24.15.0, Python 3.14.4 และ in-app browser; audio playback ทดสอบด้วย mocks ไม่ได้ฟังเสียงจาก hardware; mobile/IME ทดสอบ handler กับ viewport ไม่ได้ใช้ Android/iOS keyboard จริง; ไม่ได้ตรวจ Safari/Firefox หรือ stress test ระยะยาว

## 6. ลำดับงานที่แนะนำ

1. แก้ session lifecycle/deadline/คะแนน F01, F04 และเพิ่ม integration regression tests
2. แก้ modal/keyboard/composition F02, F05, F07 และโหมด inf F03
3. แก้ responsive/custom colors F06, F08
4. แก้ audio lifecycle/persistence/UI F09–F12
5. ปรับ validation/storage recovery/documentation และนิยาม history summary

ไม่ได้แก้ source ของแอปหรือ tests ระหว่าง audit เพิ่มเฉพาะรายงานนี้

