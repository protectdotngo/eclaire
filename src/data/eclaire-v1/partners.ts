export interface Partner {
  id: string;
  name: string;
  nameHtml?: string;
  description: string;
  url: string;
  logoUrl: string;
  hidden?: boolean;
}

export const PARTNERS: Partner[] = [
  {
    id: "action-innocence",
    name: "Action Innocence",
    description:
      "Action Innocence est une Fondation qui a pour mission de protéger les enfants et les adolescent·e·s sur Internet. Créée en 1999 à Genève, la Fondation œuvre depuis 25 ans pour la promotion d'une saine utilisation des écrans : interventions dans les écoles, production de matériel de prévention, programmes de formation pour les professionnel·le·s, campagnes de sensibilisation, etc. Grâce à ses initiatives, Action Innocence contribue à un environnement digital plus sûr pour les jeunes.",
    url: "https://www.actioninnocence.org/",
    logoUrl: "/eclaire-v1/partners/action-innocence.svg",
  },
  {
    id: "lire-et-ecrire",
    name: "Lire et Ecrire",
    description:
      "L'association Lire et Ecrire contribue à donner une réponse à la problématique de l'illettrisme. Elle organise des cours en compétences de base qui permettent à des adultes de mieux s'orienter dans leur vie familiale, sociale et professionnelle.\n\nDepuis plusieurs années, des cours TIC (Technologies de l'Information et de la Communication) pour débutants sont organisés afin de permettre à un public francophone avec des difficultés à l'écrit d'améliorer ses compétences dans l'utilisation d'un smartphone, d'une tablette ou un ordinateur. Ils sont animés par des formatrices formées aux compétences de base et à la problématique de l'illettrisme.",
    url: "https://www.lire-et-ecrire.ch/",
    logoUrl: "/eclaire-v1/partners/lire-ecrire.svg",
  },
  {
    id: "protect-ngo",
    name: "Protect.ngo",
    nameHtml: "Protect<sup>.ngo</sup>",
    description:
      "La fondation Protect.ngo est une organisation de la société civile dédiée à la protection des communautés vulnérables dans le monde numérique. Elle enquête et analyse l'impact des cybermenaces systémiques et offre gratuitement des services de cybersécurité aux organisations de la société civile en Europe.",
    url: "https://protect.ngo/",
    logoUrl: "/eclaire-v1/partners/protect-ngo.svg",
  },
  {
    id: "stop-hate-speech",
    name: "Stop Hate Speech",
    description:
      "Le projet Stop Hate Speech lutte depuis 2019 contre le discours de haine en ligne en Suisse, en combinant société civile, technologie et science. Stop Hate Speech sensibilise et active la société civile à réagir au phénomène avec des solutions testées par la science et offre un soutien aux personnes concernées. Stop Hate Speech est un projet de la Public Discourse Foundation. La fondation a pour mission d'étudier et de renforcer le débat public en ligne en collaboration directe avec l'EPFZ. Son objectif est d'améliorer le débat public de manière que le plus grand nombre possible de personnes se sentent invitées à y participer.",
    url: "https://stophatespeech.ch/fr/",
    logoUrl: "/eclaire-v1/partners/stop-hate-speech.jpg",
  },
  {
    id: "swiss-aware",
    name: "Swiss Aware",
    description:
      "Swiss Aware – SWISS Alliance for Web Awareness Resources, Education & Ethics – œuvre pour une société plus consciente des enjeux du numérique. L'organisation promeut l'éducation à la cybersécurité, récompense les technologies innovantes, et soutient des solutions durables pour un monde numérique avancé. Elle rassemble des acteurs suisses de la cybersécurité autour du développement scientifique, technologique, éducatif et éthique, à l'échelle nationale et internationale. À travers des initiatives comme le « Permis de Conduire Numérique », Swiss Aware forme les jeunes générations à adopter des comportements responsables en ligne et sur les réseaux sociaux.",
    url: "https://www.swiss-aware.com/",
    logoUrl: "/eclaire-v1/partners/swiss-aware.png",
  },
  {
    id: "tech-against-violence",
    name: "Tech against Violence",
    description:
      "L'association Tech against Violence développe des solutions numériques contre la violence afin de combler les lacunes dans l'offre de services en Suisse et d'offrir aux victimes de violence et à leur entourage un accès simple et à bas seuil aux informations et aux offres d'aide. Le premier projet #withyou soutient les personnes concernées dans la recherche d'informations, la prise de décisions et le dépistage des premiers signes de la violence au sein du couple. Le second projet, Safe withyou, les aide à documenter les épisodes de violence dans les domaines de la violence au sein du couple et du stalking.",
    url: "https://www.techagainstviolence.ch/home-f",
    logoUrl: "/eclaire-v1/partners/tech-against-violence.png",
  },
  {
    id: "violence-que-faire",
    name: "Violence Que Faire",
    description:
      "L'association VIOLENCE QUE FAIRE propose un site informatif et un service de conseil en ligne anonyme et gratuit via violencequefaire.ch. Toute personne concernée par la violence au sein d'une relation amoureuse, intime ou de couple peut poser une question de manière anonyme sur le site et recevoir une réponse de spécialistes du domaine dans un délai de 3 jours ouvrables. Il est possible d'écrire en français, anglais et italien.",
    url: "https://www.violencequefaire.ch/",
    logoUrl: "/eclaire-v1/partners/violence-que-faire.svg",
  },
  {
    id: "voie-f",
    name: "Voie F",
    description:
      "Voie F a pour mission d'encourager, de soutenir et d'accompagner les femmes peu ou pas scolarisées en situation de vulnérabilité dans un parcours de formation qui vise l'autonomie, le renforcement de leur pouvoir d'agir et la (ré)insertion sociale et professionnelle. Depuis 25 ans, cet espace de formation s'engage activement pour promouvoir l'accès des femmes aux technologies de l'information et de la communication (TIC), contribuant ainsi à leur émancipation et à leur intégration durable dans la société.",
    url: "https://voief.ch/",
    logoUrl: "/eclaire-v1/partners/voie-f.jpg",
  },
  {
    id: "wetechcare",
    name: "WeTechCare",
    description: "",
    url: "https://wetechcare.org/",
    logoUrl: "/eclaire-v1/partners/wetechcare.png",
    hidden: true,
  },
];
