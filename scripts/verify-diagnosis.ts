import { calculateBIG5Diagnosis } from '../app/src/lib/personality/logic';
import { BIG5_QUESTIONS } from '../app/src/lib/personality/constants';
import { QuestionAnswer } from '../app/src/lib/personality/types';

async function runTest() {
  console.log('Starting BIG5 Diagnosis Logic Verification...');

  // Test Case 1: All answers are 5 (Strongly Agree)
  // This should result in high scores for non-reversed items and low scores for reversed items
  console.log('\nTest Case 1: All answers = 5');
  const answers1: QuestionAnswer[] = BIG5_QUESTIONS.map(q => ({
    questionId: q.id,
    value: 5,
    timestamp: new Date().toISOString()
  }));

  const result1 = await calculateBIG5Diagnosis(answers1);
  console.log('Scores:', result1.scores);
  console.log('Type:', result1.personalityType?.name || 'None');
  console.log('Closest Type:', result1.closestType.name);

  // Test Case 2: Random answers
  console.log('\nTest Case 2: Random answers');
  const answers2: QuestionAnswer[] = BIG5_QUESTIONS.map(q => ({
    questionId: q.id,
    value: Math.floor(Math.random() * 5) + 1,
    timestamp: new Date().toISOString()
  }));

  const result2 = await calculateBIG5Diagnosis(answers2);
  console.log('Scores:', result2.scores);
  console.log('Type:', result2.personalityType?.name || 'None');
  console.log('Closest Type:', result2.closestType.name);
  
  console.log('\nVerification Complete.');
}

runTest().catch(console.error);
