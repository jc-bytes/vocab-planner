import { threatCases } from '../content.js';
import { choiceSetStep } from '../step-patterns.js';

export const guided = choiceSetStep({
  id: 'guided', title: 'Identify the danger', short: 'Threat clues', stage: 'guided', table: threatCases,
  items: [
    {title:'Case 1: New login page', question:'What danger matches a message that asks for your school password on a new page?', options:['Phishing','Ransomware','Brute-force attack'], answer:0, hint:'A fake message or login page that asks for private information is phishing.'},
    {title:'Case 2: Locked files', question:'What danger matches a download that locks files and asks for money?', options:['Phishing','Ransomware','Firewall'], answer:1, hint:'Ransomware locks files and demands payment.'},
    {title:'Case 3: Many guesses', question:'What danger matches hundreds of password guesses?', options:['Brute-force attack','Ransomware','Backup'], answer:0, hint:'Repeated password guesses are a brute-force attack.'},
    {title:'Case 4: Unsafe theme', question:'What danger matches a free theme that asks you to turn off security?', options:['Malware','Phishing','Version history'], answer:0, hint:'A harmful download is malware. Do not turn off security to install it.'},
    {title:'Case 5: Safer first action', question:'What is the safest first action after receiving an unexpected password request?', options:['Show it to the teacher and check through the official school site','Reply with the password quickly','Forward it to all classmates'], answer:0, hint:'Do not use the message link. Check through a trusted official route.'},
    {title:'Case 6: Protection for guesses', question:'Which protection makes repeated password guessing harder?', options:['A long unique password and multi-factor authentication','A shorter shared password','Turning off account alerts'], answer:0, hint:'A long unique password reduces guessing success; multi-factor authentication adds another check.'},
  ],
});
