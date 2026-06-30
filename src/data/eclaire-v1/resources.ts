export interface Resource {
  id: string;
  name: string;
  description: string;
  url: string;
  partner: string;
}

export const RESOURCES: Resource[] = [
  // 123digit (WeTechCare)
  {
    id: "123digit",
    name: "123digit",
    description:
      "123digit.ch est une plateforme gratuite conçue pour réduire la fracture numérique et accompagner en douceur les publics vers l'autonomie numérique. Il vous suffit de créer un compte pour accéder à des contenus pédagogiques variés, ludiques et thématiques, ainsi qu'à des parcours et outils pratiques pour vous former au numérique, à votre rythme.",
    url: "https://www.123digit.ch/fr/inscription-apprenant?cohort=5354645",
    partner: "wetechcare",
  },

  // Violence Que Faire
  {
    id: "conseil-en-ligne-anonyme",
    name: "Conseil en ligne anonyme et gratuit",
    description:
      "Toute personne concernée par la violence au sein du couple, qu'elle soit victime, auteure, témoin ou de l'entourage et quel que soit son âge, son orientation sexuelle et affective ou son identité de genre, peut s'adresser de manière anonyme à des spécialistes de Suisse romande et du Tessin. Dans un délai de 3 jours ouvrables, ces professionnel-l-e-s des violences domestiques répondent personnellement via la plateforme violencequefaire.ch.",
    url: "https://www.violencequefaire.ch/trouver-de-laide/",
    partner: "violence-que-faire",
  },
  {
    id: "podcast-poussiere",
    name: "Podcast Poussière",
    description:
      "Le Podcast Poussière réalisé par VIOLENCE QUE FAIRE met à disposition 8 épisodes sur 8 thématiques spécifiques des violences au sein du couple et mêle témoignages de personnes anciennement confrontées par la violence au sein du couple et paroles de spécialistes du domaine. Avec l'accord des internautes qui écrivent sur violencequefaire.ch, une partie des questions et réponses des spécialistes est publiée sur le site.",
    url: "https://www.violencequefaire.ch/podcasts/",
    partner: "violence-que-faire",
  },

  // Tech against Violence
  {
    id: "test-relation",
    name: "Test : Comment te sens-tu dans ta relation ?",
    description: "",
    url: "https://with-you.ch/fr/questionnaire-relation",
    partner: "tech-against-violence",
  },
  {
    id: "test-danger",
    name: "Test : Évaluation du danger",
    description: "",
    url: "https://with-you.ch/fr/danger",
    partner: "tech-against-violence",
  },
  {
    id: "safe-withyou",
    name: "Espace de stockage en ligne pour documenter les violences au sein du couple",
    description:
      "Safe withyou est un espace de stockage en ligne pour les preuves de violence domestique et de harcèlement.",
    url: "https://with-you.ch/fr/safe-withyou",
    partner: "tech-against-violence",
  },

  // Swiss Aware
  {
    id: "truth-swipe",
    name: "Truth Swipe",
    description:
      "Swiss Aware propose une application éducative interactive qui apprend aux utilisateurs à reconnaître la désinformation, notamment les deepfakes, de manière ludique. En balayant l'écran pour juger si une image ou une vidéo est vraie ou fausse, les joueurs développent leur esprit critique tout en s'amusant.",
    url: "https://truthswipe.digital-forge.swiss/",
    partner: "swiss-aware",
  },
  {
    id: "drive-permis-digital",
    name: "Drive, le permis de conduire Digital",
    description:
      "Swiss AWARE lance « DRIVE, le permis de conduire digital », une plateforme EdTech suisse de cloud gaming immersif où les jeunes apprennent à naviguer en toute sécurité dans le monde numérique grâce à des scénarios interactifs et multilingues. À la clé, une certification blockchain infalsifiable qui atteste de leurs compétences numériques de façon continue — cliquez sur le lien pour les derniers updates sur le développement de DRIVE, disponible à partir du troisième trimestre 2025.",
    url: "https://www.swiss-aware.com/drive",
    partner: "swiss-aware",
  },

  // Stop Hate Speech
  {
    id: "concernee-par-la-haine",
    name: "Je suis concerné·e par la haine en ligne",
    description:
      "Vivre des violences en ligne, ce n'est pas ta faute et ce n'est pas normal. Il est important de pouvoir trouver le soutien adéquat et les ressources nécessaires pour faire face à cette épreuve. Tu trouveras ci-dessous quelques conseils. Prends soin de toi !",
    url: "https://stophatespeech.ch/fr/pages/je-suis-concernée-par-la-haine-en-ligne",
    partner: "stop-hate-speech",
  },
  {
    id: "engager-contre-la-haine",
    name: "J'aimerais m'engager contre la haine",
    description:
      "Le discours de haine en ligne est publié par une minorité de personnes. En tant qu'allié·e, tu peux soutenir celles et ceux qui en sont victimes et contribuer à rendre l'espace numérique plus sûr et bienveillant. Chaque message de soutien compte – ensemble, faisons entendre nos voix contre la haine et pour le respect en ligne.",
    url: "https://stophatespeech.ch/fr/pages/tu-souhaites-être-un-e-allié-e",
    partner: "stop-hate-speech",
  },

  // Protect.ngo
  {
    id: "ia",
    name: "J'utilise l'intelligence artificielle",
    description:
      "L'intelligence artificielle fait désormais partie de notre quotidien — encore faut-il savoir l'utiliser de manière responsable. Ce guide vous aide à comprendre les usages sûrs et éthiques de l'IA dans votre vie personnelle et professionnelle.",
    url: "/eclaire-v1/resources/IA.pdf",
    partner: "protect-ngo",
  },
  {
    id: "hygiene-cyber",
    name: "Je prends soin de mon hygiène cyber",
    description:
      "Votre sécurité numérique commence par de simples habitudes. Découvrez les gestes essentiels à adopter au quotidien pour une hygiène cyber saine et durable.",
    url: "/eclaire-v1/resources/HYGIENE.pdf",
    partner: "protect-ngo",
  },
  {
    id: "cyber-arnaques",
    name: "Je me protège contre les cyber arnaques",
    description:
      "Apprenez à repérer les arnaques en ligne les plus courantes et à adopter les bons réflexes pour ne pas tomber dans le piège. Cette ressource vous guide pas à pas pour rester vigilant·e et protéger vos informations personnelles.",
    url: "/eclaire-v1/resources/ARNAQUE.pdf",
    partner: "protect-ngo",
  },

  // Action Innocence
  {
    id: "internet-tout-nest-pas-pour-moi",
    name: "Sur Internet, tout n'est pas pour moi",
    description:
      "Les enfants peuvent être exposé·e·s, volontairement ou non, à des images pornographiques sur Internet. Cette vidéo d'animation permet d'initier une discussion sur le sujet et d'agir de manière préventive. Public cible : 8-10 ans.",
    url: "https://www.actioninnocence.org/publication/sur-internet-tout-n-est-pas-pour-moi",
    partner: "action-innocence",
  },
  {
    id: "recolte-des-donnees",
    name: "Récolte des données",
    description:
      "Algorithme et cookie - Comment les sites et les applications exploitent nos données personnelles. Comment fonctionnent un algorithme et un cookie ? Tout est expliqué dans cette courte vidéo d'animation. Public cible : 12-15 ans.",
    url: "https://www.actioninnocence.org/publication/recolte-des-donnees-algorithme-et-cookie-parents/",
    partner: "action-innocence",
  },
  {
    id: "internet-reseaux-sociaux",
    name: "Lorsque j'utilise internet et les réseaux sociaux",
    description:
      "Quelques informations à connaître et conseils pratiques pour un bon usage d'internet. Public cible : 8-15 ans.",
    url: "https://www.actioninnocence.org/publication/lorsque-jutilise-internet-et-les-reseaux-sociaux-parents/",
    partner: "action-innocence",
  },
  {
    id: "grooming",
    name: "Le grooming",
    description:
      "Sur Internet, les enfants et adolescent·e·s peuvent être confronté·e·s à des personnes malintentionnées. Un flyer destiné aux parents pour les aider à comprendre le phénomène de grooming et leur donner des pistes d'action en cas d'atteinte à l'intégrité sexuelle de leur enfant. Public cible : parents d'enfants de 8-15 ans.",
    url: "https://www.actioninnocence.org/publication/depliant-grooming/",
    partner: "action-innocence",
  },
  {
    id: "hyperconnectivite",
    name: "Hyperconnectivité",
    description:
      "Nous sommes tous scotchés sur nos écrans ! Normal, ils sont prévus pour. Découvrez comment ça marche dans une vidéo d'animation. Public cible : 12-15 ans.",
    url: "https://www.actioninnocence.org/publication/hyperconnectivite-parents/",
    partner: "action-innocence",
  },
  {
    id: "vivre-avec-les-ecrans",
    name: "Vivre avec les écrans",
    description:
      "Un guide traduit en 12 langues et disponible en français simplifié pour aider les parents à accompagner leurs enfants dans l'utilisation des écrans. Public cible : parents.",
    url: "https://vivreaveclesecrans.actioninnocence.org/",
    partner: "action-innocence",
  },
];
