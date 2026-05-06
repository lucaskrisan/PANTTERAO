/**
 * Internationalization for Member Area, Customer Portal, and Checkout Success page.
 * Supports PT (Brazilian Portuguese) and EN (English).
 * Language is determined by the product currency: USD → EN, BRL → PT.
 */

export type MemberLang = "pt" | "en";

export interface MemberTranslations {
  // General
  loading: string;
  error: string;
  back: string;

  // Member Area
  lessons: string;
  catalog: string;
  welcome: (name: string) => string;
  continueWhere: string;
  lessonsCompleted: (done: number, total: number) => string;
  selectLesson: string;
  selectLessonDesc: string;
  viewLessons: string;
  previous: string;
  nextLesson: string;
  restrictedAccess: string;
  restrictedDesc: string;
  backToHome: string;
  loadingContent: string;
  // Self-service recovery
  recoverTitle: string;
  recoverDesc: string;
  recoverEmailLabel: string;
  recoverEmailPlaceholder: string;
  recoverButton: string;
  recoverSending: string;
  recoverGenericResponse: string;
  recoverInvalidEmail: string;
  portalCtaTitle: string;
  portalCtaDesc: string;
  portalCtaButton: string;
  successCreateAccountTitle: string;
  successCreateAccountDesc: string;
  successCreateAccountButton: string;

  // Sidebar
  lessonsCount: (done: number, total: number) => string;
  exploreMore: string;
  available: (count: number) => string;

  // Lesson Viewer
  completed: string;
  accessLink: string;
  downloadPdf: string;
  contentTypes: Record<string, string>;

  // Lesson Materials
  supplementaryMaterial: string;

  // Lesson Reviews
  lessonReviews: string;
  review: string;
  reviews: string;
  editReview: string;
  leaveReview: string;
  writeComment: string;
  send: string;
  update: string;
  reviewSent: string;
  reviewError: string;
  writeCommentFirst: string;
  beFirst: string;
  publishedReviews: string;
  yourReview: string;
  awaitingApproval: string;
  published: string;
  replyAction: string;
  writeReply: string;

  // Catalog
  otherCourses: string;
  expandKnowledge: string;
  noCourses: string;
  unlocked: string;
  accessCourse: string;
  buy: string;
  comingSoon: string;

  // Customer Portal
  myCourses: string;
  search: string;
  all: string;
  myCreated: string;
  purchased: string;
  noCourseFound: string;
  access: string;
  view: string;
  invalidLink: string;
  accessExpired: string;
  errorLoading: string;
  switchToProducer: string;
  logout: string;

  // Checkout Success
  paymentApproved: string;
  pixGenerated: string;
  purchaseConfirmed: (product: string) => string;
  pixPending: (product: string) => string;
  checkEmail: string;
  sentDetails: (email: string) => string;
  exclusiveOffer: string;
  buyOneClick: string;
  processing: string;
  chargedSameCard: string;
  additionalPurchased: (count: number) => string;
  upsellSuccess: (name: string) => string;
  upsellError: string;
}

const pt: MemberTranslations = {
  loading: "Carregando...",
  error: "Erro",
  back: "Voltar",

  lessons: "aulas",
  catalog: "Catálogo",
  welcome: (name) => name ? `Olá, ${name}` : "Bem-vindo",
  continueWhere: "Continue de onde parou",
  lessonsCompleted: (done, total) => `${done}/${total} aulas concluídas`,
  selectLesson: "Selecione uma aula",
  selectLessonDesc: "Escolha uma aula no menu para começar.",
  viewLessons: "Ver Aulas",
  previous: "← Anterior",
  nextLesson: "Próxima Aula →",
  restrictedAccess: "Acesso Restrito",
  restrictedDesc: "Você precisa de um link de acesso válido para entrar na área de membros.",
  backToHome: "Voltar ao Início",
  loadingContent: "Carregando seu conteúdo...",
  recoverTitle: "Reenviar meu acesso",
  recoverDesc: "Digite o e-mail usado na compra e enviaremos seus links de acesso novamente.",
  recoverEmailLabel: "Seu e-mail",
  recoverEmailPlaceholder: "voce@email.com",
  recoverButton: "Reenviar links de acesso",
  recoverSending: "Enviando...",
  recoverGenericResponse: "Se encontrarmos uma conta com este e-mail, você receberá os links em instantes. Verifique sua caixa de entrada e o spam.",
  recoverInvalidEmail: "Digite um e-mail válido.",
  portalCtaTitle: "🎓 Tem uma conta de aluno?",
  portalCtaDesc: "Acesse todos os seus cursos com um único login (igual Hotmart e Kiwify).",
  portalCtaButton: "Entrar no Portal do Aluno",
  successCreateAccountTitle: "Acesse todos os seus cursos com um único login",
  successCreateAccountDesc: "Crie sua conta de aluno uma vez e tenha acesso vitalício, igual Hotmart e Kiwify.",
  successCreateAccountButton: "Criar minha conta de aluno",

  lessonsCount: (done, total) => `${done}/${total} aulas`,
  exploreMore: "Explorar mais cursos",
  available: (count) => `${count} disponíveis`,

  completed: "Concluída",
  accessLink: "Acessar Link",
  downloadPdf: "Baixar PDF",
  contentTypes: {
    text: "Texto",
    link: "Link Externo",
    pdf: "Arquivo PDF",
    video_embed: "Vídeo",
    html: "Conteúdo Interativo",
  },

  supplementaryMaterial: "Material Complementar",

  lessonReviews: "Avaliações da Aula",
  review: "avaliação",
  reviews: "avaliações",
  editReview: "Editar sua avaliação",
  leaveReview: "Deixe sua avaliação",
  writeComment: "Escreva seu comentário sobre esta aula...",
  send: "Enviar",
  update: "Atualizar",
  reviewSent: "Avaliação enviada! Aguarde aprovação do instrutor.",
  reviewError: "Erro ao enviar avaliação.",
  writeCommentFirst: "Escreva um comentário antes de enviar.",
  beFirst: "Seja o primeiro a avaliar esta aula!",
  publishedReviews: "Avaliações publicadas",
  yourReview: "Sua avaliação",
  awaitingApproval: "Aguardando aprovação",
  published: "Publicada",
  replyAction: "Responder",
  writeReply: "Escreva uma resposta...",

  otherCourses: "Outros Cursos",
  expandKnowledge: "Expanda seu conhecimento",
  noCourses: "Nenhum outro curso disponível no momento.",
  unlocked: "Liberado",
  accessCourse: "Acessar Curso",
  buy: "Comprar",
  comingSoon: "Em breve",

  myCourses: "Meus Cursos",
  search: "Buscar...",
  all: "Todos",
  myCreated: "Meus cursos",
  purchased: "Comprados",
  noCourseFound: "Nenhum curso encontrado.",
  access: "Acessar",
  view: "Visualizar",
  invalidLink: "Link inválido ou expirado",
  accessExpired: "Seu acesso expirou.",
  errorLoading: "Erro ao carregar conteúdo.",
  switchToProducer: "Mudar para painel do produtor",
  logout: "Sair",

  paymentApproved: "Pagamento Aprovado!",
  pixGenerated: "PIX Gerado com Sucesso!",
  purchaseConfirmed: (product) => `Sua compra de "${product}" foi confirmada.`,
  pixPending: (product) => `Após a confirmação do pagamento, você receberá o acesso a "${product}".`,
  checkEmail: "Verifique seu e-mail",
  sentDetails: (email) => `Enviamos os detalhes da compra para`,
  exclusiveOffer: "Oferta exclusiva para você!",
  buyOneClick: "Comprar com 1 clique",
  processing: "Processando...",
  chargedSameCard: "Cobrado no mesmo cartão utilizado na compra anterior",
  additionalPurchased: (count) => `${count} produto(s) adicional(is) adquirido(s) com sucesso!`,
  upsellSuccess: (name) => `🎉 ${name} adquirido com sucesso!`,
  upsellError: "Erro ao processar compra. Tente novamente.",
};

const en: MemberTranslations = {
  loading: "Loading...",
  error: "Error",
  back: "Back",

  lessons: "lessons",
  catalog: "Catalog",
  welcome: (name) => name ? `Hi, ${name}` : "Welcome",
  continueWhere: "Pick up where you left off",
  lessonsCompleted: (done, total) => `${done}/${total} lessons completed`,
  selectLesson: "Select a lesson",
  selectLessonDesc: "Choose a lesson from the menu to get started.",
  viewLessons: "View Lessons",
  previous: "← Previous",
  nextLesson: "Next Lesson →",
  restrictedAccess: "Restricted Access",
  restrictedDesc: "You need a valid access link to enter the member area.",
  backToHome: "Back to Home",
  loadingContent: "Loading your content...",
  recoverTitle: "Resend my access",
  recoverDesc: "Enter the e-mail you used at checkout and we'll send your access links again.",
  recoverEmailLabel: "Your e-mail",
  recoverEmailPlaceholder: "you@email.com",
  recoverButton: "Resend access links",
  recoverSending: "Sending...",
  recoverGenericResponse: "If we find an account with this e-mail, you'll receive your links shortly. Check your inbox and spam folder.",
  recoverInvalidEmail: "Please enter a valid e-mail.",
  portalCtaTitle: "🎓 Have a student account?",
  portalCtaDesc: "Access all your courses with a single login (just like Hotmart and Kiwify).",
  portalCtaButton: "Sign in to Student Portal",
  successCreateAccountTitle: "Access all your courses with one login",
  successCreateAccountDesc: "Create your student account once and get lifetime access, just like Hotmart and Kiwify.",
  successCreateAccountButton: "Create my student account",

  lessonsCount: (done, total) => `${done}/${total} lessons`,
  exploreMore: "Explore more courses",
  available: (count) => `${count} available`,

  completed: "Completed",
  accessLink: "Open Link",
  downloadPdf: "Download PDF",
  contentTypes: {
    text: "Text",
    link: "External Link",
    pdf: "PDF File",
    video_embed: "Video",
    html: "Interactive Content",
  },

  supplementaryMaterial: "Supplementary Materials",

  lessonReviews: "Lesson Reviews",
  review: "review",
  reviews: "reviews",
  editReview: "Edit your review",
  leaveReview: "Leave a review",
  writeComment: "Write your comment about this lesson...",
  send: "Submit",
  update: "Update",
  reviewSent: "Review submitted! Awaiting instructor approval.",
  reviewError: "Failed to submit review.",
  writeCommentFirst: "Please write a comment before submitting.",
  beFirst: "Be the first to review this lesson!",
  publishedReviews: "Published reviews",
  yourReview: "Your review",
  awaitingApproval: "Awaiting approval",
  published: "Published",
  replyAction: "Reply",
  writeReply: "Write a reply...",

  otherCourses: "Other Courses",
  expandKnowledge: "Expand your knowledge",
  noCourses: "No other courses available at the moment.",
  unlocked: "Unlocked",
  accessCourse: "Access Course",
  buy: "Buy",
  comingSoon: "Coming soon",

  myCourses: "My Courses",
  search: "Search...",
  all: "All",
  myCreated: "My courses",
  purchased: "Purchased",
  noCourseFound: "No courses found.",
  access: "Access",
  view: "View",
  invalidLink: "Invalid or expired link",
  accessExpired: "Your access has expired.",
  errorLoading: "Failed to load content.",
  switchToProducer: "Switch to producer panel",
  logout: "Log out",

  paymentApproved: "Payment Approved!",
  pixGenerated: "PIX Generated Successfully!",
  purchaseConfirmed: (product) => `Your purchase of "${product}" has been confirmed.`,
  pixPending: (product) => `After payment confirmation, you will receive access to "${product}".`,
  checkEmail: "Check your email",
  sentDetails: (email) => `We sent the purchase details to`,
  exclusiveOffer: "Exclusive offer for you!",
  buyOneClick: "Buy with 1 click",
  processing: "Processing...",
  chargedSameCard: "Charged to the same card used in your previous purchase",
  additionalPurchased: (count) => `${count} additional product(s) purchased successfully!`,
  upsellSuccess: (name) => `🎉 ${name} purchased successfully!`,
  upsellError: "Failed to process purchase. Please try again.",
};

const translations: Record<MemberLang, MemberTranslations> = { pt, en };

export function getMemberTranslations(lang: MemberLang): MemberTranslations {
  return translations[lang] || translations.en;
}

/**
 * Determine language from product currency.
 * USD products → English, BRL products → Portuguese.
 */
export function langFromCurrency(currency: string | null | undefined): MemberLang {
  if (!currency) return "pt";
  return currency.toUpperCase() === "USD" ? "en" : "pt";
}
