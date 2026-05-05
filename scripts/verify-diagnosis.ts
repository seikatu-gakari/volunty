import { calculateBIG5Diagnosis } from '../app/src/lib/personality/logic';
import { getQuestionsForMode } from '../app/src/lib/personality/constants';
import { DiagnosisMode, QuestionAnswer } from '../app/src/lib/personality/types';

async function verifyMode(mode: DiagnosisMode) {
  const questions = getQuestionsForMode(mode);

  console.log(`\n=== ${mode} mode (${questions.length} questions) ===`);

  // Test Case 1: All answers are neutral
  console.log('\nTest Case 1: All answers = 3');
  const answers1: QuestionAnswer[] = questions.map(q => ({
    questionId: q.id,
    value: 3,
    timestamp: new Date().toISOString()
  }));

  const result1 = await calculateBIG5Diagnosis(answers1, mode);
  console.log('Scores:', result1.scores);
  console.log('Type:', result1.personalityType?.name || 'None');
  console.log('Closest Type:', result1.closestType.name);

  // Test Case 2: Random answers
  console.log('\nTest Case 2: Random answers');
  const answers2: QuestionAnswer[] = questions.map(q => ({
    questionId: q.id,
    value: Math.floor(Math.random() * 5) + 1,
    timestamp: new Date().toISOString()
  }));

  const result2 = await calculateBIG5Diagnosis(answers2, mode);
  console.log('Scores:', result2.scores);
  console.log('Type:', result2.personalityType?.name || 'None');
  console.log('Closest Type:', result2.closestType.name);
}

async function runTest() {
  console.log('Starting BIG5 Diagnosis Logic Verification...');
  await verifyMode('brief');
  await verifyMode('full');
  
  console.log('\nVerification Complete.');
}

runTest().catch(console.error);
