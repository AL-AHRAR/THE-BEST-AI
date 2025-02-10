'use strict';

const apiKey = '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'; // **تم إضافة مفتاح API مباشرة - تنبيه: غير آمن للإنتاج!**
const modelName = 'deepseek-r1-distill-llama-70b';
const maxTokensModel = 131072; // **تم تحديث الحد الأقصى للرموز بناءً على الوثائق: 131072**
const defaultTemperature = 0.7; // **تم إعادة درجة الحرارة إلى 0.7 للحصول على استقرار أكبر**

let conversationHistory = [];
let isFetchingResponse = false;

function decodeHTMLEntities(text) {
    var tempElement = document.createElement('textarea');
    tempElement.innerHTML = text;
    return tempElement.value;
}

function adjustTextareaHeight(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight) + 'px';
}

function handleTextareaInput() {
    var textarea = document.getElementById('chat_bot');
    adjustTextareaHeight(textarea);
}

let timeoutId;

function showSuccessMessage() {
    const alertDiv = document.querySelector('.success-alert');
    alertDiv.classList.add('show');

    if (timeoutId) {
        clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(function () {
        alertDiv.classList.remove('show');
    }, 4000);
}

// دالة الكتابة التدريجية للنص (مُعدلة لكتابة 4 كلمات في المرة الواحدة وبسرعة فائقة مع تحسين التنسيق النهائي)
function typeWriter(segments, segmentIndex = 0) {
    if (!segments || segmentIndex >= segments.length) {
        // بعد الانتهاء من جميع المقاطع، قم بتلوين الكود في جميع كتل <pre><code>
        document.querySelectorAll('pre code').forEach(block => {
            hljs.highlightElement(block);
            // إضافة تأخير زمني بسيط قبل تفعيل أرقام الأسطر
            setTimeout(() => {
                hljs.lineNumbersBlock(block); // تفعيل أرقام الأسطر لكل كتلة كود بعد التلوين
            }, 50); // تأخير 50 مللي ثانية - يمكن تعديل هذا الرقم إذا لزم الأمر

            // إضافة زر النسخ إلى عنصر <pre> الأب
            const preElement = block.parentNode; // الحصول على عنصر <pre>
            if (preElement) {
                preElement.style.position = 'relative'; // لجعل الزر позиционируется بشكل مطلق بالنسبة إلى <pre>
                preElement.insertAdjacentHTML('beforeend', copyButtonHTML); // إضافة زر النسخ داخل <pre>
            }
        });
        return;
    }

    const currentSegment = segments[segmentIndex];

    if (!currentSegment || !currentSegment.element) {
        console.error("Invalid segment encountered:", currentSegment);
        typeWriter(segments, segmentIndex + 1);
        return;
    }

    const element = currentSegment.element;
    const text = currentSegment.text;
    const speed = currentSegment.speed; // استخدام السرعة المحددة لكل مقطع

    // تقسيم النص إلى كلمات مع الحفاظ على المسافات البيضاء المتعددة والأسطر الجديدة
    const words = text.split(/(\s+)/); // تقسيم بواسطة المسافات مع الاحتفاظ بالمسافات كفواصل
    let wordIndex = 0;
    let currentText = '';
    let isCodeBlock = element.querySelector('pre code') !== null;
    const wordsPerFrame = 4; // عدد الكلمات المراد كتابتها في كل إطار

    function typingFrame() {
        let frameWords = ''; // تجميع الكلمات للإطار الحالي
        let wordsToAdd = 0;

        while (wordsToAdd < wordsPerFrame && wordIndex < words.length) {
            frameWords += (frameWords ? ' ' : '') + words[wordIndex]; // إضافة الكلمة أو المسافة (المسافات محفوظة الآن)
            wordIndex++;
            wordsToAdd++;
        }
        currentText += frameWords; // تجميع الكلمات المضافة إلى النص الحالي

        if (currentText) {
            let processedText;
            if (isCodeBlock) {
                processedText = currentText;
                element.querySelector('code').textContent = processedText;
                // **تم إزالة التلوين هنا، سيتم التلوين بعد انتهاء جميع المقاطع**
            } else {
                // معالجة Markdown لجميع الأجزاء بنفس السرعة
                processedText = marked.parse(currentText, { breaks: true, gfm: true, sanitize: true }); // تأكد من تمرير الخيارات هنا أيضًا
                element.innerHTML = processedText;

                // **تحسين العناوين: إضافة كلاس "enhanced-heading" للحاوية**
                element.classList.add('enhanced-heading');
            }
        }

        if (wordIndex < words.length) {
            requestAnimationFrame(typingFrame);
        } else {
            typeWriter(segments, segmentIndex + 1);
        }
    }

    typingFrame();
}

function appendMessage(sender, messageText) {
    const mainMessagesDiv = document.querySelector('main');
    let segments = [];

    if (sender === 'bot' && messageText.includes('<think>') && messageText.includes('</think>')) {
        const parts = messageText.split('<think>');
        let beforeThink = parts[0] ? parts[0].trim() : '';
        let thinkingPart = parts[1] ? parts[1].split('</think>')[0].trim() : '';
        let afterThink = parts[1] ? parts[1].split('</think>')[1].trim() : '';

        if (thinkingPart) { // عرض رسالة التفكير أولاً وبسرعة فائقة
            const thinkingDiv = document.createElement('div');
            thinkingDiv.classList.add('message', 'bot-message', 'thinking-message');
            mainMessagesDiv.appendChild(thinkingDiv);
            segments.push({ text: thinkingPart, speed: 1, element: thinkingDiv }); // سرعة فائقة (1) لرسالة التفكير
        }
        if (beforeThink) {
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('message', 'bot-message');
            mainMessagesDiv.appendChild(messageDiv);
            // **تعديل هام:** استخدام Marked.parse هنا لمعالجة Markdown في الرسالة
            segments.push({ text: beforeThink, speed: 1, element: messageDiv }); // سرعة فائقة (1) للجزء الأول
        }
        if (afterThink) {
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('message', 'bot-message');
            mainMessagesDiv.appendChild(messageDiv);
            // **تعديل هام:** استخدام Marked.parse هنا لمعالجة Markdown في الرسالة
            segments.push({ text: afterThink, speed: 1, element: messageDiv }); // سرعة فائقة (1) للجزء الأخير
        }
    } else { // رسائل البوت العادية (بدون <think>) بسرعة فائقة أيضاً
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${sender}-message`); // استخدام `${sender}-message` هنا بشكل صحيح
        mainMessagesDiv.appendChild(messageDiv);
        // **تعديل هام:** استخدام Marked.parse هنا لمعالجة Markdown في الرسالة
        segments.push({ text: messageText, speed: 1, element: messageDiv }); // سرعة فائقة (1) للرسائل العادية
    }

    typeWriter(segments);
    mainMessagesDiv.scrollTop = mainMessagesDiv.scrollHeight;
}

async function getGroqAIResponse(userMessage) {
    const systemMessage = {
        role: 'system',
        content: `أنت مساعد ذكي باللغة العربية الفصحى، اسمك "الأحرار". **هام جدًا: يجب أن تكون جميع ردودك باللغة العربية الفصحى فقط.  ممنوع منعًا باتًا وتحت أي ظرف استخدام أي لغة أخرى غير اللغة العربية الفصحى.  يُحظر تمامًا استخدام اللغة الصينية بأي شكل من الأشكال، سواء كانت كلمات أو جمل أو حتى أحرف صينية منفردة.  يجب أن تكون جميع إجاباتك وتفاعلاتك باللغة العربية الفصحى النقية فقط، وبدون أي استثناءات.** أنت ممتاز في فهم اللغة العربية واللهجات، والإجابة باللغة العربية الفصحى بأسلوب مهذب ومفيد. يمكنك تنسيق الأكواد البرمجية باحترافية. **تذكر دائمًا: اللغة العربية الفصحى هي اللغة الوحيدة المسموح بها في ردودك.**`
    };

    if (conversationHistory.length === 0) {
        conversationHistory = [systemMessage];
    }

    conversationHistory.push({ role: 'user', content: userMessage });

    const apiUrl = 'https://api.groq.com/openai/v1/chat/completions';

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                'model': modelName,
                'messages': conversationHistory,
                'temperature': defaultTemperature,
                'max_tokens': maxTokensModel
            })
        });

        if (!response.ok) {
            console.error(`API Error: Status ${response.status}`);
            let errorMessage = `عفواً، حدث خطأ في استلام رد الذكاء الاصطناعي (رمز الخطأ: ${response.status}).`;

            if (response.status === 400 || response.status === 429) {
                errorMessage += ' قد تكون المحادثة طويلة جدًا وتجاوزت قدرة النموذج على المعالجة. يرجى محاولة أن تكون أكثر إيجازًا أو بدء محادثة جديدة.';
            } else if (response.status === 401 || response.status === 403) {
                errorMessage += ' يبدو أن هناك مشكلة في مصادقة مفتاح API. يرجى التأكد من صحة المفتاح.';
            } else if (response.status >= 500) {
                errorMessage += ' هناك مشكلة في خادم خدمة الذكاء الاصطناعي. يرجى المحاولة مرة أخرى لاحقًا.';
            }

            const errorText = await response.text();
            console.error("Error Response Text:", errorText);
            return errorMessage;
        }


        const data = await response.json();

        if (data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
            let aiResponseContent = data.choices[0].message.content;
            aiResponseContent = decodeHTMLEntities(aiResponseContent);
            conversationHistory.push({ role: 'assistant', content: aiResponseContent });
            return aiResponseContent;

        } else {
            console.error("Unexpected API response structure:", data);
            return "عفواً، حدث خطأ غير متوقع في استلام رد الذكاء الاصطناعي.";
        }

    } catch (error) {
        console.error("Error calling Groq API:", error);
        return "عفواً، حدث خطأ في الاتصال بخدمة الذكاء الاصطناعي.";
    }
}


async function handleSubmit(event) {
    event.preventDefault();

    if (isFetchingResponse) return;
    isFetchingResponse = true;

    const submitButton = document.querySelector('.btn-submit');
    const textarea = document.getElementById('chat_bot');

    submitButton.disabled = true;
    textarea.disabled = true;
    textarea.placeholder = "جارٍ التحميل...";

    showSuccessMessage();

    const userMessage = textarea.value;
    if (userMessage.trim() !== '') {
        appendMessage('user', userMessage);
        textarea.value = '';
        try {
            const aiResponse = await getGroqAIResponse(userMessage);
            if (aiResponse.startsWith("عفواً، حدث خطأ")) {
                appendMessage('bot', aiResponse);
            } else {
                appendMessage('bot', aiResponse);
            }
        } catch (apiError) {
            appendMessage('bot', "عفواً، حدث خطأ أثناء معالجة رد الذكاء الاصطناعي.");
            console.error("Error processing AI response:", apiError);
        }
    }

    adjustTextareaHeight(textarea);

    submitButton.disabled = false;
    textarea.disabled = false;
    textarea.placeholder = "✦˚ تخيَّل شيئًا واكتبه هنا...";
    isFetchingResponse = false;
    return false;
}

function showModelInfo() {
    var modelInfo = document.getElementById("model-info");
    modelInfo.style.display = "block";

    document.querySelector('#model-info .model-content p').innerHTML = `
    اسم النموذج: <b style="color:#6ee7b7;">AL-AHRAR V2</b> <br>
    النموذج المستخدم: <b>${modelName}</b> <br>
    الحد الأقصى للرموز (Tokens): <b>${maxTokensModel}</b> رمز <br>
    درجة الحرارة الافتراضية: <b>${defaultTemperature}</b> <br><br>
    مدعوم من AlA7r4r، مع لمسة إبداعية من الإنترنت لمساعدة البشر على الإبداع والابتكار. 🦾 💪 .
    `;
}

// HTML لزر النسخ (تم تعريفه خارج دالة window.onload ليكون متاحًا في النطاق العام)
const copyButtonHTML = `
<button class="btn-copy">
  <span
    data-text-end="Copied!"
    data-text-initial="Copy"
    class="cp-tooltip"
  ></span>
  <span>
    <svg
      xml:space="preserve"
      style="enable-background:new 0 0 512 512"
      viewBox="0 0 6.35 6.35"
      y="0"
      x="0"
      height="20"
      width="20"
      xmlns:xlink="http://www.w3.org/1999/xlink"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      class="cp-clipboard"
    >
      <g>
        <path
          fill="currentColor"
          d="M2.43.265c-.3 0-.548.236-.573.53h-.328a.74.74 0 0 0-.735.734v3.822a.74.74 0 0 0 .735.734H4.82a.74.74 0 0 0 .735-.734V1.529a.74.74 0 0 0-.735-.735h-.328a.58.58 0 0 0-.573-.53zm0 .529h1.49c.032 0 .049.017.049.049v.431c0 .032-.017.049-.049.049H2.43c-.032 0-.05-.017-.05-.049V.843c0-.032.018-.05.05-.05zm-.901.53h.328c.026.292.274.528.573.528h1.49a.58.58 0 0 0 .573-.529h.328a.2.2 0 0 1 .206.206v3.822a.2.2 0 0 1-.206-.205H1.53a.2.2 0 0 1-.206-.205V1.529a.2.2 0 0 1 .206-.206z"
        ></path>
      </g>
    </svg>
    <svg
      xml:space="preserve"
      style="enable-background:new 0 0 512 512"
      viewBox="0 0 24 24"
      y="0"
      x="0"
      height="18"
      width="18"
      xmlns:xlink="http://www.w3.org/1999/xlink"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      class="cp-check-mark"
    >
      <g>
        <path
          data-original="#000000"
          fill="currentColor"
          d="M9.707 19.121a.997.997 0 0 1-1.414 0l-5.646-5.647a1.5 1.5 0 0 1 0-2.121l.707-.707a1.5 1.5 0 0 1 2.121 0L9 14.171l9.525-9.525a1.5 1.5 0 0 1 2.121 0l.707.707a1.5 1.5 0 0 1 0 2.121z"
        ></path>
      </g>
    </svg>
  </span>
</button>
`;


window.onload = function () {
    var textarea = document.getElementById('chat_bot');
    textarea.addEventListener('input', handleTextareaInput);
    adjustTextareaHeight(textarea);

    var submitButton = document.querySelector('.btn-submit');
    submitButton.addEventListener('click', handleSubmit);

    let messageButton = document.getElementById('btn-message');
    messageButton.onclick = showModelInfo;

    var modelInfoElement = document.getElementById("model-info");
    let closeButton = document.querySelector('.close');

    if (closeButton) {
        closeButton.onclick = function () {
            modelInfoElement.style.display = "none";
        };
    }

    window.onclick = function (event) {
        if (event.target == modelInfoElement) {
            modelInfoElement.style.display = "none";
        }
    }

    // تهيئة Marked.js Options
    marked.setOptions({
        breaks: true,
        gfm: true,
        sanitize: true,
        highlight: function (code, lang) {
            const validLang = hljs.getLanguage(lang) ? lang : 'javascript';
            const highlightedCode = hljs.highlight(code, { language: validLang }).value;
            return '<pre class="hljs-ln"><code>' + highlightedCode + '</code></pre>';
        }
    });

    hljs.highlightAll();

    document.addEventListener('click', function (event) {
        if (event.target.closest('.btn-copy')) {
            const copyButton = event.target.closest('.btn-copy');
            const preElement = copyButton.closest('pre');
            if (preElement) {
                const codeElement = preElement.querySelector('code');
                if (codeElement) {
                    const codeText = codeElement.innerText;

                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(codeText).then(() => {
                            copyButton.focus();
                            setTimeout(() => {
                                copyButton.blur();
                            }, 2000);
                        }).catch(err => {
                            console.error('فشل نسخ النص: ', err);
                            alert('فشل نسخ الكود إلى الحافظة.');
                        });
                    } else {
                        console.warn('Clipboard API غير مدعوم في هذا المتصفح.');
                        alert('خاصية نسخ الكود غير مدعومة في هذا المتصفح.');
                    }
                }
            }
        }
    });

    conversationHistory = [];
};