        // DOM elements
        const logo = document.getElementById('logo');

        // State variables
        let recognition = null;
        let isListening = false;
        let isSpeaking = false;
        let conversationHistory = [];

        // Initialize speech recognition
        function initSpeechRecognition() {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

            if (!SpeechRecognition) {
                console.error('Speech recognition not supported in this browser');
                return;
            }

            recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            recognition.onstart = () => {
                isListening = true;
                logo.className = 'logo listening';
                console.log('🎤 Listening...');
            };

            recognition.onresult = async (event) => {
                const transcript = event.results[0][0].transcript;
                console.log('👤 User said:', transcript);
                logo.className = 'logo processing';

                try {
                    const aiResponse = await getAIResponse(transcript);
                    console.log('🤖 AI Response:', aiResponse);
                    
                    logo.className = 'logo speaking';
                    speakText(aiResponse);
                } catch (error) {
                    console.error('❌ API Error:', error);
                    logo.className = 'logo idle';
                }
            };

            recognition.onerror = (event) => {
                isListening = false;
                logo.className = 'logo idle';
                console.error('❌ Speech recognition error:', event.error);
            };

            recognition.onend = () => {
                isListening = false;
                if (!isSpeaking) {
                    logo.className = 'logo idle';
                }
            };
        }

        // Get AI response from API
        async function getAIResponse(message) {
            conversationHistory.push({ role: 'user', content: message });

            const response = await fetch('https://ai.learneng.app/LearnEng/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: JSON.stringify(conversationHistory)
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            const aiResponse = data.response;

            conversationHistory.push({ role: 'assistant', content: aiResponse });
            return aiResponse;
        }

        // Speak text using speech synthesis
        function speakText(text) {
            if (!window.speechSynthesis) {
                console.error('Speech synthesis not supported in this browser');
                logo.className = 'logo idle';
                return;
            }

            isSpeaking = true;
            console.log('🔊 Speaking...');

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;

            utterance.onend = () => {
                isSpeaking = false;
                logo.className = 'logo idle';
                console.log('✅ Finished speaking');
            };

            utterance.onerror = (event) => {
                isSpeaking = false;
                logo.className = 'logo idle';
                console.error('❌ Speech error:', event.error);
            };

            speechSynthesis.speak(utterance);
        }

        // Add ripple effect
        function addRippleEffect() {
            logo.classList.add('ripple');
            setTimeout(() => {
                logo.classList.remove('ripple');
            }, 600);
        }

        // Logo click handler
        logo.addEventListener('click', async () => {
            addRippleEffect();
            
            if (isSpeaking) {
                speechSynthesis.cancel();
                logo.className = 'logo idle';
                isSpeaking = false;
                console.log('🛑 Stopped speaking');
                return;
            }

            if (isListening) {
                recognition.stop();
                logo.className = 'logo idle';
                console.log('🛑 Stopped listening');
                return;
            }

            try {
                // Request mic permission
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(track => track.stop()); // release mic

                if (!recognition) {
                    initSpeechRecognition();
                }

                recognition.start();
            } catch (err) {
                console.error('❌ Microphone access denied:', err);
                logo.className = 'logo idle';
            }
        });

        // Initialize on page load
        document.addEventListener('DOMContentLoaded', () => {
            initSpeechRecognition();
            console.log('🚀 Vidya Voice Assistant initialized');
        });