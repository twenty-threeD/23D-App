import { formatNumber } from './http'

// 계약서 문구. 작성 화면의 미리보기와 서버에 올리는 PDF 가 같은 문구여야 해서 한 곳에 둔다
// (웹은 ContractWizardModal 과 contractPdf 에 같은 문구를 따로 적어 두었다. 문구를 고칠 땐 웹도 같이 고친다)

export interface ContractTerms {
  serviceContent: string
  startDate: string
  endDate: string
  /** 작성 중에는 빈칸일 수 있어 문자열도 받는다 */
  inspectionDays: number | string
  price: number
}

/** 'YYYY-MM-DD' → 'YYYY년 M월 D일'. Date 로 바꾸면 기기 시간대에 따라 하루가 밀릴 수 있어 글자를 그대로 나눈다 */
export function formatContractDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '')
  if (!match) return ''
  return `${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}일`
}

/** 이름 마지막 글자의 받침 유무에 따라 조사를 고른다 (완성형 한글 밖이면 받침 없는 쪽) */
export function josa(word: string, withBatchim: string, withoutBatchim: string) {
  const trimmed = word.trim()
  if (!trimmed) return withoutBatchim
  const lastChar = trimmed.charCodeAt(trimmed.length - 1)
  if (lastChar < 0xac00 || lastChar > 0xd7a3) return withoutBatchim
  return (lastChar - 0xac00) % 28 !== 0 ? withBatchim : withoutBatchim
}

export function contractArticles(terms: ContractTerms): { title: string; body: string }[] {
  const price = terms.price ? formatNumber(terms.price) : ''
  const inspectionDays = String(terms.inspectionDays ?? '') || ' '
  return [
    {
      title: '제 1 조 (용역의 내용)',
      body: terms.serviceContent || '본 계약에서 수행하고자 하는 용역의 내용을 명시한다.',
    },
    {
      title: '제 2 조 (용역의 기간)',
      body: `본 용역의 수행 기간은 ${formatContractDate(terms.startDate)} 부터 ${formatContractDate(terms.endDate)} 까지로 하며, 부득이한 사유로 기간을 변경하게 되는 경우 서면으로 합의한다.`,
    },
    {
      title: '제 3 조 (대금 및 지급)',
      body: `1. 계약의 총액은 금 ${price}원으로 하며, 갑이 을에게 지급한다.\n2. 갑은 용역 이행에 대한 검수 후 영업일 기준 3일 이내에 을에게 대금을 지급한다.`,
    },
    {
      title: '제 4 조 (계약 이행 및 검수)',
      body: `1. 을은 용역 제공자로서 제 1조에 명시되어 있는 용역의 내용을 성실히 수행할 의무를 가진다.\n2. 갑은 을이 수행한 용역의 결과에 대해 ${inspectionDays}일 이내에 검수 결과를 서면 혹은 전자적 방법으로 통지해야하며, 통지하지 않는 경우 용역 결과를 수용한다는 의미로 간주하고 계약을 종료한다.`,
    },
    {
      title: '제 5 조 (비밀유지)',
      body: '갑과 을 양측은 본 계약을 수행하며 알게된 상대방의 영업비밀 및 영업상의 비밀을 계약을 체결한 이후로 제 3자에게 누설해서는 안된다.',
    },
    {
      title: '제 6 조 (계약해지)',
      body: '갑 또는 을이 본 계약의 내용을 위반하고 이에 대해 상당한 기간을 정하여 시정을 요구했음에도 불구하고 당사자가 시정하지 않는 경우 서면 또는 전자적 방법으로 계약해지를 통지할 수 있다.',
    },
    {
      title: '제 7 조 (분쟁 해결)',
      body: '본 계약과 관련하여 분쟁이 발생하는 경우, 상호 협의로 해결을 우선시 하며 협의가 이루어지지 아니한 경우 서울중앙지방법원을 제1심 관할 법원으로 한다.',
    },
    {
      title: '제 8 조 (지식재산권 이전)',
      body: '본 용역의 수행 과정에서 발생한 결과물에 대한 저작권 등 지식재산권은 갑의 검수 후 즉시 갑에게 귀속된다.',
    },
    {
      title: '제 9 조 (계약의 효력)',
      body: '1. 본 계약은 양 당사자가 서명 또는 기명날인한 날부터 효력을 발생하며, 본 계약서는 갑과 을, 용역 중개 서비스에서 전자적 방법 등으로 보관한다.\n2. 제 5조(비밀유지)에 한해서 계약이 종료된 이후에도 유효하다.',
    },
  ]
}
