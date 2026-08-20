const fs = require('fs');
let code = fs.readFileSync('src/pages/Customers.tsx', 'utf-8');

const targetStr = `recognition.onresult = (event: any) => {
      setIsListening(false);
      const transcript = event.results[0][0].transcript;

      const phoneMatches = transcript.match(/\\d+/g);
      const phone = phoneMatches ? phoneMatches.join('').slice(0, 10) : '';
      const name = transcript.replace(/\\d+/g, '').trim();

      setFormData(prev => ({
        ...prev,
        name: name || prev.name,
        phone: phone || prev.phone
      }));
    };`;

const replaceStr = `recognition.onresult = async (event: any) => {
      setIsListening(false);
      const transcript = event.results[0][0].transcript;
      
      try {
        const parsed = await parseContactFromText(transcript);
        
        setFormData(prev => ({
          ...prev,
          name: parsed.name || prev.name,
          phone: parsed.phone || prev.phone,
          company_name: parsed.company_name || prev.company_name,
          email: parsed.email || prev.email,
          address: parsed.address || prev.address,
          gst_number: parsed.gst_number || prev.gst_number
        }));
      } catch (error) {
        console.error("Parse failed, falling back to basic extraction", error);
        const phoneMatches = transcript.match(/\\d+/g);
        const phone = phoneMatches ? phoneMatches.join('').slice(0, 10) : '';
        const name = transcript.replace(/\\d+/g, '').trim();

        setFormData(prev => ({
          ...prev,
          name: name || prev.name,
          phone: phone || prev.phone
        }));
      }
    };`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('src/pages/Customers.tsx', code);
