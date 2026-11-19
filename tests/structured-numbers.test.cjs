const {test,before}=require('node:test'),assert=require('node:assert/strict');
let numbers;
before(async()=>numbers=await import('../src/numericText.mjs'));
test('axis components accept finite numbers and reject incomplete or unsafe values',()=>{
 for(const [text,value]of [['0',0],[' -2.5 ',-2.5],['3e2',300],['+.5',.5]])assert.equal(numbers.parseNumber(text),value);
 for(const text of ['', '?', '-', 'NaN', 'Infinity', '1e309', '1e-9999', '9007199254740992', '1+1','1,2,3','X=1','process.exit()'])assert.throws(()=>numbers.parseNumber(text),text);
});
test('free ratio text requires both numbers and a positive denominator',()=>{
 assert.equal(numbers.parseRatio(' 16 / 9 '),16/9);assert.equal(numbers.parseRatio('-1 / 10'),-.1);assert.equal(numbers.parseRatio('1e1 / 2.5'),4);assert.equal(numbers.formatRatio(16/9),'16 / 9');
 for(const text of ['', '? / ?', '16', '16/', '/9', '1/0', '1/-1','1/2/3', 'Infinity/1','1/NaN','1e309/1','1e-9999/1','1/(2+3)'])assert.throws(()=>numbers.parseRatio(text),text);
});

test('decimal steppers avoid floating tails and retain literal precision',()=>{
 assert.equal(numbers.stepNumber('0.2',.01),'0.21');assert.equal(numbers.stepNumber('0.21',-.01),'0.2');
 assert.equal(numbers.stepNumber('1e-8',1e-8),'2e-8');assert.equal(numbers.stepNumber('-.5',.1),'-0.4');
 assert.equal(numbers.stepNumber('0.12345678901234566',1),'1.1234567890123457');
 for(const text of ['-','Infinity','1e-9999','9007199254740992'])assert.equal(numbers.stepNumber(text,1),text);
});
