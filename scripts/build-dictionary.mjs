/**
 * CC-CEDICT 파싱 + 한국어 매핑 스크립트
 * 
 * 1. CC-CEDICT 텍스트 파일을 파싱
 * 2. 빈도순 상위 10,000 단어 추출
 * 3. 핵심 단어에 한국어 뜻 + 한국식 발음 매핑
 * 4. JSON 사전 파일 생성
 * 
 * 실행: node scripts/build-dictionary.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ============================================================
// CC-CEDICT 다운로드
// ============================================================

const CEDICT_URL = 'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz';
const CEDICT_PATH = join(ROOT, 'scripts', 'cedict.txt');

async function downloadCedict() {
  if (existsSync(CEDICT_PATH)) {
    console.log('CC-CEDICT already downloaded.');
    return;
  }
  
  console.log('Downloading CC-CEDICT...');
  const gzPath = CEDICT_PATH + '.gz';
  
  try {
    execSync(`curl -L -o "${gzPath}" "${CEDICT_URL}"`, { stdio: 'inherit' });
    // Try gunzip
    try {
      execSync(`gzip -d "${gzPath}"`, { stdio: 'inherit' });
    } catch {
      // Windows: try PowerShell decompress
      execSync(`powershell -Command "& { $input = [System.IO.File]::OpenRead('${gzPath.replace(/\\/g, '\\\\')}'); $gzip = New-Object System.IO.Compression.GZipStream($input, [System.IO.Compression.CompressionMode]::Decompress); $output = [System.IO.File]::Create('${CEDICT_PATH.replace(/\\/g, '\\\\')}'); $gzip.CopyTo($output); $output.Close(); $gzip.Close(); $input.Close() }"`, { stdio: 'inherit' });
    }
    console.log('CC-CEDICT downloaded and extracted.');
  } catch (err) {
    console.error('Failed to download CC-CEDICT:', err.message);
    console.log('Please manually download from:', CEDICT_URL);
    console.log('Extract to:', CEDICT_PATH);
    process.exit(1);
  }
}

// ============================================================
// CC-CEDICT 파싱
// ============================================================

function parseCedict(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const entries = [];

  for (const line of lines) {
    if (line.startsWith('#') || line.trim() === '') continue;
    
    // Format: Traditional Simplified [pinyin] /definition1/definition2/
    // Use more permissive regex for Chinese characters
    const match = line.match(/^(.+?)\s+(.+?)\s+\[([^\]]+)\]\s+\/(.+)\/\s*$/);
    if (!match) continue;

    const [, traditional, simplified, pinyinRaw, definitionRaw] = match;
    const definitions = definitionRaw.split('/').filter(d => d.trim());
    const pinyin = convertNumericPinyin(pinyinRaw);

    entries.push({
      traditional,
      simplified,
      pinyin,
      pinyinRaw,
      definitions,
    });
  }

  return entries;
}

// ============================================================
// 숫자 병음 → 성조 부호 변환
// ============================================================

const TONE_MARKS = {
  'a': ['ā', 'á', 'ǎ', 'à', 'a'],
  'e': ['ē', 'é', 'ě', 'è', 'e'],
  'i': ['ī', 'í', 'ǐ', 'ì', 'i'],
  'o': ['ō', 'ó', 'ǒ', 'ò', 'o'],
  'u': ['ū', 'ú', 'ǔ', 'ù', 'u'],
  'ü': ['ǖ', 'ǘ', 'ǚ', 'ǜ', 'ü'],
};

function convertNumericPinyin(pinyinWithNumbers) {
  // "ni3 hao3" → "nǐhǎo"
  const syllables = pinyinWithNumbers.split(' ');
  return syllables.map(s => convertSyllable(s.toLowerCase())).join('');
}

function convertSyllable(syllable) {
  // Handle u: → ü
  syllable = syllable.replace(/u:/g, 'ü').replace(/v/g, 'ü');
  
  const toneMatch = syllable.match(/([1-5])$/);
  if (!toneMatch) return syllable;
  
  const tone = parseInt(toneMatch[1]) - 1; // 0-indexed (0-4)
  const base = syllable.slice(0, -1);
  
  if (tone === 4) return base; // tone 5 = neutral, no mark
  
  // Find vowel to place tone mark
  // Rule: a/e always take it, ou → o takes it, otherwise last vowel
  const vowels = 'aeiouü';
  
  if (base.includes('a')) return replaceTone(base, 'a', tone);
  if (base.includes('e')) return replaceTone(base, 'e', tone);
  if (base.includes('ou')) return replaceTone(base, 'o', tone);
  
  // Find second vowel, or last vowel
  let vowelCount = 0;
  for (let i = 0; i < base.length; i++) {
    if (vowels.includes(base[i])) {
      vowelCount++;
      if (vowelCount === 2) return replaceTone(base, base[i], tone, i);
    }
  }
  
  // Single vowel
  for (let i = 0; i < base.length; i++) {
    if (vowels.includes(base[i])) return replaceTone(base, base[i], tone, i);
  }
  
  return base;
}

function replaceTone(str, vowel, tone, specificIndex) {
  const toned = TONE_MARKS[vowel]?.[tone] || vowel;
  if (specificIndex !== undefined) {
    return str.slice(0, specificIndex) + toned + str.slice(specificIndex + 1);
  }
  return str.replace(vowel, toned);
}

// ============================================================
// 빈도 데이터 (상위 빈도 한자 기반 추정)
// ============================================================

// 간단한 빈도 추정: 글자 수가 적을수록, HSK 레벨이 낮을수록 빈도 높음
function estimateFrequency(entry, index) {
  const lengthBonus = Math.max(0, 5 - entry.simplified.length) * 1000;
  return Math.max(1, 10000 - index + lengthBonus);
}

// ============================================================
// 핵심 한국어 매핑 (별도 파일에서 로드)
// ============================================================

import { EN_TO_KR, EN_TO_KR_EXTRA } from './kr-mappings.mjs';
import { HANZI_TO_KR, HANZI_TO_KR_FIX } from './hanzi-kr-map.mjs';

// HANZI_TO_KR과 HANZI_TO_KR_FIX를 합침 (FIX가 우선)
const HANZI_KR_ALL = { ...HANZI_TO_KR, ...HANZI_TO_KR_FIX };

function translateToKorean(englishDefs) {
  for (const def of englishDefs) {
    const cleaned = def.replace(/\([^)]*\)/g, '').trim().toLowerCase();
    
    // 1차: EN_TO_KR 직접 매칭
    if (EN_TO_KR[cleaned]) return EN_TO_KR[cleaned];
    
    // 2차: EN_TO_KR_EXTRA 직접 매칭
    if (EN_TO_KR_EXTRA[cleaned]) return EN_TO_KR_EXTRA[cleaned];
    
    // "to X" 패턴
    const toMatch = cleaned.match(/^to (.+)/);
    if (toMatch) {
      if (EN_TO_KR[`to ${toMatch[1]}`]) return EN_TO_KR[`to ${toMatch[1]}`];
      if (EN_TO_KR_EXTRA[`to ${toMatch[1]}`]) return EN_TO_KR_EXTRA[`to ${toMatch[1]}`];
    }
    
    // 단어별 매칭 시도 (EN_TO_KR + EN_TO_KR_EXTRA 모두)
    const words = cleaned.split(/[\s,;]+/);
    for (const word of words) {
      if (EN_TO_KR[word]) return EN_TO_KR[word];
      if (EN_TO_KR_EXTRA[word]) return EN_TO_KR_EXTRA[word];
    }
  }
  
  // 매칭 실패 → 영어 첫 번째 정의 반환
  return englishDefs[0] || '';
}

// ============================================================
// HSK 1-6 필수 단어 목록 (간체)
// ============================================================

const HSK_WORDS = {
  1: ['我','你','他','她','它','我们','你们','他们','这','那','哪','什么','谁','哪儿','多少','几','怎么','怎么样','是','不','有','没','在','的','了','吗','呢','很','都','也','和','人','一','二','三','四','五','六','七','八','九','十','百','千','万','个','大','小','多','少','好','冷','热','高兴','漂亮','中国','北京','今天','明天','昨天','上午','下午','年','月','日','星期','天','时候','现在','点','分','家','学校','医院','饭店','商店','中午','爸爸','妈妈','儿子','女儿','老师','学生','同学','朋友','医生','先生','小姐','做','看','听','说','读','写','吃','喝','去','来','回','住','坐','买','叫','学习','工作','睡觉','打电话','开','下雨','爱','喜欢','想','认识','会','能','请','谢谢','对不起','没关系','再见','名字','书','汉语','字','桌子','椅子','水','茶','米饭','菜','水果','苹果','杯子','钱','飞机','出租车','电脑','电视','电影','天气','猫','狗','前面','后面','里面','上','下','东西','些','岁','对','太','不客气','衣服','里','块','本'],
  2: ['但是','因为','所以','虽然','如果','还是','或者','已经','正在','一起','别','可能','可以','觉得','知道','希望','准备','告诉','帮助','开始','完','到','走','跑','找','给','送','卖','等','让','问','回答','介绍','生日','快乐','快','慢','新','旧','长','远','近','贵','便宜','错','忙','累','难','容易','重要','有意思','白','黑','红','身体','眼睛','脸','手','脚','头','哥哥','姐姐','弟弟','妹妹','丈夫','妻子','孩子','男人','女人','服务员','教室','房间','路','门','公司','机场','公共汽车','自行车','船','手机','手表','鸡蛋','牛奶','面条','西瓜','鱼','羊肉','药','考试','题','问题','意思','颜色','事情','时间','小时','早上','晚上','去年','生病','休息','运动','游泳','踢足球','篮球','唱歌','跳舞','旅游','上班','笑','哭','穿','玩','过'],
  3: ['虽然','如果','除了','另外','而且','不但','只要','才','就','又','再','比','最','更','越','非常','特别','几乎','终于','突然','马上','刚才','后来','从来','一直','其实','当然','一定','必须','应该','需要','愿意','打算','决定','选择','变化','发现','感觉','相信','担心','着急','生气','满意','同意','关心','注意','了解','经历','经验','根据','按照','为了','关于','向','往','从','离','把','被','让','得','地','过','着','世界','环境','地方','附近','周围','中间','旁边','对面','方向','东','南','西','北','春天','夏天','秋天','冬天','阴','晴','风','雪','温度','太阳','月亮','城市','国家','文化','历史','社会','经济','科学','技术','艺术','音乐','体育','比赛','节目','新闻','广告','网络','电子邮件','办法','作用','条件','情况','结果','原因','目的','机会','困难','危险','安全','普通','简单','复杂','清楚','正确','错误'],
  4: ['不管','尽管','否则','即使','无论','于是','然而','不过','反而','看来','果然','居然','竟然','似乎','大概','至少','甚至','尤其','逐渐','往往','总是','始终','偶尔','并','却','倒','究竟','到底','难道','简直','恐怕','千万','挺','免得','以便','以来','之间','之前','之后','以内','以外','当中','其中','目前','如今','将来','从此','至今','允许','鼓励','邀请','拒绝','禁止','限制','提醒','催','劝','吸引','感动','激动','惊讶','羡慕','佩服','怀疑','抱歉','后悔','失望','骄傲','自信','勇敢','诚实','温柔','幽默','严格','积极','消极','合理','及时','完美','自然','正式','具体','明确','丰富','详细','深','浅','轻','重','松','紧','厚','薄','软','硬'],
  5: ['何况','从而','进而','以至','以致','乃至','况且','何必','不妨','宁可','与其','假如','万一','一旦','不免','未免','好在','难免','索性','反正','毕竟','总算','幸亏','到底','偏偏','恰恰','分别','各自','互相','彼此','依然','仍然','照样','也许','大约','果然','居然','竟然','的确','确实','可见','显然','明明','千万','务必','未必','不见得','难怪','怪不得','何况','另外','此外','再说','总之','由此可见','既然','可见','比如','例如','即','也就是说','据说','所谓','充分','分别','依次','连续','相继','陆续','纷纷','一一','逐步','反复','再三','始终','暂时','临时','长期','及时','随时','顿时','立刻','连忙','急忙','赶紧','赶快'],
  6: ['诸','凡','皆','且','乃','予','之','乎','也','矣','焉','哉','兮','其','彼','此','某','该','本','各','每','另','别','另外','以及','及','或','乃至','甚至','连','除非','不论','无论','不管','任凭','宁可','与其','除了','除此之外','对于','关于','至于','按照','根据','通过','经过','由于','鉴于','以便','以免','为了','从而','因此','所以','于是','既然','由此','故','则','虽','虽然','但','但是','不过','然而','却','可是','只是','就是','即使','即便','哪怕','纵使','任凭','竟','竟然','居然','偏偏','恰恰','刚好','恰好','偶然','果然','忽然','突然','猛然','骤然','顿时','瞬间','霎时','一下子','立即','马上','赶紧','连忙','急忙'],
};

// ============================================================
// 메인 실행
// ============================================================

async function main() {
  await downloadCedict();
  
  console.log('Parsing CC-CEDICT...');
  const entries = parseCedict(CEDICT_PATH);
  console.log(`Parsed ${entries.length} entries.`);
  
  // HSK 단어 집합 생성
  const hskWordSet = new Set();
  const hskLevelMap = new Map(); // hanzi → hsk level
  for (const [level, words] of Object.entries(HSK_WORDS)) {
    for (const word of words) {
      hskWordSet.add(word);
      hskLevelMap.set(word, parseInt(level));
    }
  }
  console.log(`HSK 전체 단어: ${hskWordSet.size}개`);

  // CC-CEDICT를 한자(simplified)로 인덱싱
  const cedictMap = new Map();
  for (const entry of entries) {
    if (!cedictMap.has(entry.simplified)) {
      cedictMap.set(entry.simplified, entry);
    }
  }

  // ─── 사전 구성 전략 ───────────────────────────────────────────────
  // 1. HSK 전체 단어 (무조건 포함)
  // 2. HANZI_TO_KR 매핑이 있는 단어 (무조건 포함)
  // 3. CC-CEDICT에서 2글자 이상 일상 단어 전체
  // 4. 1글자 단어 중 흔한 것만 (성씨/이형 제외)

  const included = new Map(); // hanzi → entry data

  // Step 1: HSK 단어 전체 포함
  for (const word of hskWordSet) {
    const cedictEntry = cedictMap.get(word);
    if (cedictEntry) {
      included.set(word, cedictEntry);
    }
  }
  console.log(`Step 1 (HSK): ${included.size}개`);

  // Step 2: HANZI_KR_ALL 매핑 있는 단어
  for (const hanzi of Object.keys(HANZI_KR_ALL)) {
    if (!included.has(hanzi)) {
      const cedictEntry = cedictMap.get(hanzi);
      if (cedictEntry) {
        included.set(hanzi, cedictEntry);
      }
    }
  }
  console.log(`Step 2 (+HANZI_KR_ALL): ${included.size}개`);

  // Step 3: 2글자 이상 단어 전체 (variant/surname 제외)
  for (const entry of entries) {
    if (included.has(entry.simplified)) continue;
    if (entry.simplified.length >= 2) {
      // "variant of", "old variant" 등 제외
      const firstDef = (entry.definitions[0] || '').toLowerCase();
      if (firstDef.startsWith('variant of') || firstDef.startsWith('old variant') ||
          firstDef.startsWith('archaic variant') || firstDef.startsWith('see ')) continue;
      included.set(entry.simplified, entry);
    }
  }
  console.log(`Step 3 (+2글자이상): ${included.size}개`);

  // Step 4: 1글자 단어 중 유용한 것만 (성씨, variant 제외)
  for (const entry of entries) {
    if (included.has(entry.simplified)) continue;
    if (entry.simplified.length === 1) {
      const firstDef = (entry.definitions[0] || '').toLowerCase();
      // 성씨, variant, 희귀 글자 제외
      if (firstDef.startsWith('surname') || firstDef.startsWith('variant of') ||
          firstDef.startsWith('old variant') || firstDef.startsWith('archaic') ||
          firstDef.startsWith('see ') || firstDef.startsWith('used in')) continue;
      included.set(entry.simplified, entry);
    }
  }
  console.log(`Step 4 (+유용한 1글자): ${included.size}개`);
  
  // ─── 사전 빌드 ───────────────────────────────────────────────
  console.log('Building dictionary with Korean translations...');
  
  let index = 0;
  const dictionary = [];
  for (const [hanzi, entry] of included) {
    const hskLevel = hskLevelMap.get(hanzi) || null;
    dictionary.push({
      hanzi,
      pinyin: entry.pinyin,
      meaning: HANZI_KR_ALL[hanzi] || translateToKorean(entry.definitions),
      meaningEn: entry.definitions[0] || '',
      koreanPronunciation: '',
      frequency: estimateFrequency(entry, index),
      hskLevel,
    });
    index++;
  }
  
  // JSON 출력
  const outputPath = join(ROOT, 'public', 'dictionary.json');
  writeFileSync(outputPath, JSON.stringify(dictionary, null, 0), 'utf-8');
  
  const sizeKB = Math.round(readFileSync(outputPath).length / 1024);
  const sizeMB = (sizeKB / 1024).toFixed(1);
  console.log(`\n=== 결과 ===`);
  console.log(`사전 파일: ${outputPath}`);
  console.log(`총 단어 수: ${dictionary.length}개 (${sizeMB}MB)`);
  
  // 통계
  const withKorean = dictionary.filter(d => !/^[a-zA-Z(]/.test(d.meaning));
  console.log(`한국어 뜻: ${withKorean.length}개 (${Math.round(withKorean.length/dictionary.length*100)}%)`);
  console.log(`영어 뜻: ${dictionary.length - withKorean.length}개`);
  
  // HSK 포함률
  console.log(`\n=== HSK 포함률 ===`);
  for (const [level, words] of Object.entries(HSK_WORDS)) {
    const found = words.filter(w => included.has(w));
    console.log(`HSK${level}: ${found.length}/${words.length} (${Math.round(found.length/words.length*100)}%)`);
  }
}

main().catch(console.error);
