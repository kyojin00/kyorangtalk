const adjectives = [
  '조용한', '따뜻한', '맑은', '작은', '귀여운',
  '슬픈', '행복한', '외로운', '설레는', '차가운',
  '포근한', '수줍은', '용감한', '엉뚱한', '신비한',
  '다정한', '솔직한', '여린', '강한', '나른한'
]
const nouns = [
  '달팽이', '별빛', '구름', '바람', '이슬',
  '파도', '노을', '새벽', '봄비', '낙엽',
  '반딧불', '눈송이', '무지개', '안개', '햇살',
  '고양이', '토끼', '여우', '물고기', '나비'
]

export function generateNickname(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  return `${adj} ${noun}`
}