/*
 * Search page strings, per site language.
 *
 * The search page exists once per language folder (/en/search, /de/search, ...)
 * and each copy searches only its own namespace. Everything the reader sees that
 * is not a search result comes from here, so a language is added in one place:
 *
 *   - UI: the block's own text (sort, counts, paging, empty state, filters);
 *   - LIBRARY: the label rows the StreamX bundle reads from the authored table
 *     (`inputPlaceholder`, `totalResults`, ...). The block fills any the page
 *     does not author, so a locale page needs only its `namespace` row;
 *   - FACETS: facet headings and the facet VALUES the ingest pipeline writes in
 *     English (content types, topics, a few technologies). Values are filter keys
 *     and stay English in the index and the URL; only their label is translated.
 *     A value with no entry here shows as indexed — product names (AEM, StreamX)
 *     are meant to.
 *
 * The language is the page's own (`<html lang>`, set from the path by
 * scripts/lang.js), falling back to English for anything not listed.
 *
 * Translations were written by hand rather than sent through Smartling: there
 * are few of them and they change rarely. `{name}` placeholders are filled by
 * `t`; library templates keep the bundle's own `{{totalCount}}` syntax.
 */

const STRINGS = {
  en: {
    published: 'Published ',
    readMore: 'Read more',
    sortBy: 'Sort by',
    relevance: 'Relevance',
    date: 'Date',
    showing: 'Showing {start}-{end} of {total} Results',
    page: 'Page {n}',
    firstPage: 'Go to first page',
    prevPage: 'Go to previous page',
    nextPage: 'Go to next page',
    lastPage: 'Go to last page',
    noResultsFor: 'No results for “{query}”.',
    noResults: 'No results found.',
    hintFiltered: 'Check the spelling, use more general words, or remove some filters.',
    hint: 'Check the spelling, or use more general words.',
    clearAll: 'Clear all filters',
    viewResults: 'View Results',
    viewResultsOne: 'View 1 Result',
    viewResultsMany: 'View {n} Results',
    sortsAndFilters: 'Sorts and filters',
    filter: 'Filter',
    filterGroup: 'Filter {group}',
    filterValues: 'Filter values',
    removeFilter: 'Remove filter {name}',
    openSearch: 'Open search',
    closeSearch: 'Close search',
    poweredBy: 'Search powered by:',
  },
  de: {
    published: 'Veröffentlicht am ',
    readMore: 'Weiterlesen',
    sortBy: 'Sortieren nach',
    relevance: 'Relevanz',
    date: 'Datum',
    showing: '{start}–{end} von {total} Ergebnissen',
    page: 'Seite {n}',
    firstPage: 'Zur ersten Seite',
    prevPage: 'Zur vorherigen Seite',
    nextPage: 'Zur nächsten Seite',
    lastPage: 'Zur letzten Seite',
    noResultsFor: 'Keine Ergebnisse für „{query}“.',
    noResults: 'Keine Ergebnisse gefunden.',
    hintFiltered: 'Prüfen Sie die Schreibweise, verwenden Sie allgemeinere Begriffe oder entfernen Sie einige Filter.',
    hint: 'Prüfen Sie die Schreibweise oder verwenden Sie allgemeinere Begriffe.',
    clearAll: 'Alle Filter entfernen',
    viewResults: 'Ergebnisse anzeigen',
    viewResultsOne: '1 Ergebnis anzeigen',
    viewResultsMany: '{n} Ergebnisse anzeigen',
    sortsAndFilters: 'Sortierung und Filter',
    filter: 'Filtern',
    filterGroup: '{group} filtern',
    filterValues: 'Werte filtern',
    removeFilter: 'Filter {name} entfernen',
    openSearch: 'Suche öffnen',
    closeSearch: 'Suche schließen',
    poweredBy: 'Suche bereitgestellt von:',
  },
  es: {
    published: 'Publicado el ',
    readMore: 'Leer más',
    sortBy: 'Ordenar por',
    relevance: 'Relevancia',
    date: 'Fecha',
    showing: 'Mostrando {start}-{end} de {total} resultados',
    page: 'Página {n}',
    firstPage: 'Ir a la primera página',
    prevPage: 'Ir a la página anterior',
    nextPage: 'Ir a la página siguiente',
    lastPage: 'Ir a la última página',
    noResultsFor: 'No hay resultados para «{query}».',
    noResults: 'No se encontraron resultados.',
    hintFiltered: 'Revise la ortografía, use palabras más generales o quite algunos filtros.',
    hint: 'Revise la ortografía o use palabras más generales.',
    clearAll: 'Borrar todos los filtros',
    viewResults: 'Ver resultados',
    viewResultsOne: 'Ver 1 resultado',
    viewResultsMany: 'Ver {n} resultados',
    sortsAndFilters: 'Orden y filtros',
    filter: 'Filtrar',
    filterGroup: 'Filtrar {group}',
    filterValues: 'Filtrar valores',
    removeFilter: 'Quitar el filtro {name}',
    openSearch: 'Abrir la búsqueda',
    closeSearch: 'Cerrar la búsqueda',
    poweredBy: 'Búsqueda impulsada por:',
  },
  fr: {
    published: 'Publié le ',
    readMore: 'Lire la suite',
    sortBy: 'Trier par',
    relevance: 'Pertinence',
    date: 'Date',
    showing: 'Résultats {start}-{end} sur {total}',
    page: 'Page {n}',
    firstPage: 'Aller à la première page',
    prevPage: 'Aller à la page précédente',
    nextPage: 'Aller à la page suivante',
    lastPage: 'Aller à la dernière page',
    noResultsFor: 'Aucun résultat pour « {query} ».',
    noResults: 'Aucun résultat trouvé.',
    hintFiltered: 'Vérifiez l’orthographe, utilisez des termes plus généraux ou retirez certains filtres.',
    hint: 'Vérifiez l’orthographe ou utilisez des termes plus généraux.',
    clearAll: 'Effacer tous les filtres',
    viewResults: 'Voir les résultats',
    viewResultsOne: 'Voir 1 résultat',
    viewResultsMany: 'Voir {n} résultats',
    sortsAndFilters: 'Tri et filtres',
    filter: 'Filtrer',
    filterGroup: 'Filtrer : {group}',
    filterValues: 'Filtrer les valeurs',
    removeFilter: 'Retirer le filtre {name}',
    openSearch: 'Ouvrir la recherche',
    closeSearch: 'Fermer la recherche',
    poweredBy: 'Recherche propulsée par :',
  },
  it: {
    published: 'Pubblicato il ',
    readMore: 'Leggi di più',
    sortBy: 'Ordina per',
    relevance: 'Pertinenza',
    date: 'Data',
    showing: 'Risultati {start}-{end} di {total}',
    page: 'Pagina {n}',
    firstPage: 'Vai alla prima pagina',
    prevPage: 'Vai alla pagina precedente',
    nextPage: 'Vai alla pagina successiva',
    lastPage: 'Vai all’ultima pagina',
    noResultsFor: 'Nessun risultato per «{query}».',
    noResults: 'Nessun risultato trovato.',
    hintFiltered: 'Controlla l’ortografia, usa termini più generici o rimuovi alcuni filtri.',
    hint: 'Controlla l’ortografia o usa termini più generici.',
    clearAll: 'Cancella tutti i filtri',
    viewResults: 'Vedi risultati',
    viewResultsOne: 'Vedi 1 risultato',
    viewResultsMany: 'Vedi {n} risultati',
    sortsAndFilters: 'Ordinamento e filtri',
    filter: 'Filtra',
    filterGroup: 'Filtra {group}',
    filterValues: 'Filtra valori',
    removeFilter: 'Rimuovi il filtro {name}',
    openSearch: 'Apri la ricerca',
    closeSearch: 'Chiudi la ricerca',
    poweredBy: 'Ricerca basata su:',
  },
  pl: {
    published: 'Opublikowano ',
    readMore: 'Czytaj więcej',
    sortBy: 'Sortuj według',
    relevance: 'Trafność',
    date: 'Data',
    showing: 'Wyniki {start}–{end} z {total}',
    page: 'Strona {n}',
    firstPage: 'Przejdź do pierwszej strony',
    prevPage: 'Przejdź do poprzedniej strony',
    nextPage: 'Przejdź do następnej strony',
    lastPage: 'Przejdź do ostatniej strony',
    noResultsFor: 'Brak wyników dla „{query}”.',
    noResults: 'Nie znaleziono wyników.',
    hintFiltered: 'Sprawdź pisownię, użyj bardziej ogólnych słów lub usuń niektóre filtry.',
    hint: 'Sprawdź pisownię lub użyj bardziej ogólnych słów.',
    clearAll: 'Wyczyść wszystkie filtry',
    viewResults: 'Pokaż wyniki',
    viewResultsOne: 'Pokaż 1 wynik',
    viewResultsMany: 'Pokaż wyniki ({n})',
    sortsAndFilters: 'Sortowanie i filtry',
    filter: 'Filtruj',
    filterGroup: 'Filtruj: {group}',
    filterValues: 'Filtruj wartości',
    removeFilter: 'Usuń filtr {name}',
    openSearch: 'Otwórz wyszukiwanie',
    closeSearch: 'Zamknij wyszukiwanie',
    poweredBy: 'Wyszukiwanie obsługiwane przez:',
  },
  pt: {
    published: 'Publicado em ',
    readMore: 'Leia mais',
    sortBy: 'Ordenar por',
    relevance: 'Relevância',
    date: 'Data',
    showing: 'Mostrando {start}-{end} de {total} resultados',
    page: 'Página {n}',
    firstPage: 'Ir para a primeira página',
    prevPage: 'Ir para a página anterior',
    nextPage: 'Ir para a próxima página',
    lastPage: 'Ir para a última página',
    noResultsFor: 'Nenhum resultado para “{query}”.',
    noResults: 'Nenhum resultado encontrado.',
    hintFiltered: 'Verifique a ortografia, use palavras mais gerais ou remova alguns filtros.',
    hint: 'Verifique a ortografia ou use palavras mais gerais.',
    clearAll: 'Limpar todos os filtros',
    viewResults: 'Ver resultados',
    viewResultsOne: 'Ver 1 resultado',
    viewResultsMany: 'Ver {n} resultados',
    sortsAndFilters: 'Ordenação e filtros',
    filter: 'Filtrar',
    filterGroup: 'Filtrar {group}',
    filterValues: 'Filtrar valores',
    removeFilter: 'Remover o filtro {name}',
    openSearch: 'Abrir a pesquisa',
    closeSearch: 'Fechar a pesquisa',
    poweredBy: 'Pesquisa com tecnologia de:',
  },
  ja: {
    published: '公開日: ',
    readMore: '続きを読む',
    sortBy: '並べ替え',
    relevance: '関連性',
    date: '日付',
    showing: '{total}件中 {start}～{end}件を表示',
    page: '{n}ページ',
    firstPage: '最初のページへ',
    prevPage: '前のページへ',
    nextPage: '次のページへ',
    lastPage: '最後のページへ',
    noResultsFor: '「{query}」に一致する結果はありません。',
    noResults: '結果が見つかりませんでした。',
    hintFiltered: 'スペルを確認するか、より一般的な語句を使うか、フィルターをいくつか解除してください。',
    hint: 'スペルを確認するか、より一般的な語句をお試しください。',
    clearAll: 'すべてのフィルターを解除',
    viewResults: '結果を表示',
    viewResultsOne: '1件の結果を表示',
    viewResultsMany: '{n}件の結果を表示',
    sortsAndFilters: '並べ替えと絞り込み',
    filter: '絞り込み',
    filterGroup: '{group}で絞り込み',
    filterValues: '値を絞り込み',
    removeFilter: 'フィルター「{name}」を解除',
    openSearch: '検索を開く',
    closeSearch: '検索を閉じる',
    poweredBy: '検索技術提供：',
  },
  ko: {
    published: '게시일: ',
    readMore: '더 보기',
    sortBy: '정렬 기준',
    relevance: '관련성',
    date: '날짜',
    showing: '{total}개 중 {start}-{end}개 표시',
    page: '{n}페이지',
    firstPage: '첫 페이지로 이동',
    prevPage: '이전 페이지로 이동',
    nextPage: '다음 페이지로 이동',
    lastPage: '마지막 페이지로 이동',
    noResultsFor: '“{query}”에 대한 결과가 없습니다.',
    noResults: '결과를 찾을 수 없습니다.',
    hintFiltered: '맞춤법을 확인하거나, 더 일반적인 단어를 사용하거나, 일부 필터를 제거해 보세요.',
    hint: '맞춤법을 확인하거나 더 일반적인 단어를 사용해 보세요.',
    clearAll: '모든 필터 지우기',
    viewResults: '결과 보기',
    viewResultsOne: '결과 1개 보기',
    viewResultsMany: '결과 {n}개 보기',
    sortsAndFilters: '정렬 및 필터',
    filter: '필터',
    filterGroup: '{group} 필터',
    filterValues: '값 필터',
    removeFilter: '{name} 필터 제거',
    openSearch: '검색 열기',
    closeSearch: '검색 닫기',
    poweredBy: '검색 기술 제공:',
  },
  'zh-cn': {
    published: '发布于 ',
    readMore: '阅读更多',
    sortBy: '排序方式',
    relevance: '相关性',
    date: '日期',
    showing: '显示第 {start}-{end} 条，共 {total} 条结果',
    page: '第 {n} 页',
    firstPage: '转到第一页',
    prevPage: '转到上一页',
    nextPage: '转到下一页',
    lastPage: '转到最后一页',
    noResultsFor: '没有找到与“{query}”相关的结果。',
    noResults: '未找到结果。',
    hintFiltered: '请检查拼写、使用更通用的词语，或移除部分筛选条件。',
    hint: '请检查拼写，或使用更通用的词语。',
    clearAll: '清除所有筛选',
    viewResults: '查看结果',
    viewResultsOne: '查看 1 条结果',
    viewResultsMany: '查看 {n} 条结果',
    sortsAndFilters: '排序和筛选',
    filter: '筛选',
    filterGroup: '筛选{group}',
    filterValues: '筛选值',
    removeFilter: '移除筛选条件 {name}',
    openSearch: '打开搜索',
    closeSearch: '关闭搜索',
    poweredBy: '搜索技术支持：',
  },
  'zh-tw': {
    published: '發布於 ',
    readMore: '閱讀更多',
    sortBy: '排序方式',
    relevance: '相關性',
    date: '日期',
    showing: '顯示第 {start}-{end} 筆，共 {total} 筆結果',
    page: '第 {n} 頁',
    firstPage: '前往第一頁',
    prevPage: '前往上一頁',
    nextPage: '前往下一頁',
    lastPage: '前往最後一頁',
    noResultsFor: '找不到與「{query}」相關的結果。',
    noResults: '找不到結果。',
    hintFiltered: '請檢查拼字、使用更通用的詞語，或移除部分篩選條件。',
    hint: '請檢查拼字，或使用更通用的詞語。',
    clearAll: '清除所有篩選',
    viewResults: '查看結果',
    viewResultsOne: '查看 1 筆結果',
    viewResultsMany: '查看 {n} 筆結果',
    sortsAndFilters: '排序與篩選',
    filter: '篩選',
    filterGroup: '篩選{group}',
    filterValues: '篩選值',
    removeFilter: '移除篩選條件 {name}',
    openSearch: '開啟搜尋',
    closeSearch: '關閉搜尋',
    poweredBy: '搜尋技術支援：',
  },
};

/*
 * The StreamX bundle's own label rows, as the authored table names them. The
 * block appends a row for each one the page does not author.
 */
const LIBRARY = {
  en: {
    inputPlaceholder: 'Search Arbory Digital',
    inputLabel: 'Search',
    clearButtonAria: 'Clear search input',
    searchButtonAria: 'Search',
    totalResults: '{{totalCount}} results',
    ariaPaginationGoToPage: 'Go to page {{pageNumber}}',
    ariaPaginationNavigation: 'Pagination',
  },
  de: {
    inputPlaceholder: 'Arbory Digital durchsuchen',
    inputLabel: 'Suche',
    clearButtonAria: 'Sucheingabe löschen',
    searchButtonAria: 'Suchen',
    totalResults: '{{totalCount}} Ergebnisse',
    ariaPaginationGoToPage: 'Zu Seite {{pageNumber}}',
    ariaPaginationNavigation: 'Seitennavigation',
  },
  es: {
    inputPlaceholder: 'Buscar en Arbory Digital',
    inputLabel: 'Buscar',
    clearButtonAria: 'Borrar la búsqueda',
    searchButtonAria: 'Buscar',
    totalResults: '{{totalCount}} resultados',
    ariaPaginationGoToPage: 'Ir a la página {{pageNumber}}',
    ariaPaginationNavigation: 'Paginación',
  },
  fr: {
    inputPlaceholder: 'Rechercher sur Arbory Digital',
    inputLabel: 'Recherche',
    clearButtonAria: 'Effacer la recherche',
    searchButtonAria: 'Rechercher',
    totalResults: '{{totalCount}} résultats',
    ariaPaginationGoToPage: 'Aller à la page {{pageNumber}}',
    ariaPaginationNavigation: 'Pagination',
  },
  it: {
    inputPlaceholder: 'Cerca in Arbory Digital',
    inputLabel: 'Cerca',
    clearButtonAria: 'Cancella la ricerca',
    searchButtonAria: 'Cerca',
    totalResults: '{{totalCount}} risultati',
    ariaPaginationGoToPage: 'Vai alla pagina {{pageNumber}}',
    ariaPaginationNavigation: 'Paginazione',
  },
  pl: {
    inputPlaceholder: 'Szukaj w Arbory Digital',
    inputLabel: 'Szukaj',
    clearButtonAria: 'Wyczyść wyszukiwanie',
    searchButtonAria: 'Szukaj',
    totalResults: 'Wyniki: {{totalCount}}',
    ariaPaginationGoToPage: 'Przejdź do strony {{pageNumber}}',
    ariaPaginationNavigation: 'Paginacja',
  },
  pt: {
    inputPlaceholder: 'Pesquisar na Arbory Digital',
    inputLabel: 'Pesquisar',
    clearButtonAria: 'Limpar a pesquisa',
    searchButtonAria: 'Pesquisar',
    totalResults: '{{totalCount}} resultados',
    ariaPaginationGoToPage: 'Ir para a página {{pageNumber}}',
    ariaPaginationNavigation: 'Paginação',
  },
  ja: {
    inputPlaceholder: 'Arbory Digital を検索',
    inputLabel: '検索',
    clearButtonAria: '検索語をクリア',
    searchButtonAria: '検索',
    totalResults: '{{totalCount}}件の結果',
    ariaPaginationGoToPage: '{{pageNumber}}ページへ',
    ariaPaginationNavigation: 'ページ送り',
  },
  ko: {
    inputPlaceholder: 'Arbory Digital 검색',
    inputLabel: '검색',
    clearButtonAria: '검색어 지우기',
    searchButtonAria: '검색',
    totalResults: '결과 {{totalCount}}개',
    ariaPaginationGoToPage: '{{pageNumber}}페이지로 이동',
    ariaPaginationNavigation: '페이지 탐색',
  },
  'zh-cn': {
    inputPlaceholder: '搜索 Arbory Digital',
    inputLabel: '搜索',
    clearButtonAria: '清除搜索内容',
    searchButtonAria: '搜索',
    totalResults: '{{totalCount}} 条结果',
    ariaPaginationGoToPage: '转到第 {{pageNumber}} 页',
    ariaPaginationNavigation: '分页',
  },
  'zh-tw': {
    inputPlaceholder: '搜尋 Arbory Digital',
    inputLabel: '搜尋',
    clearButtonAria: '清除搜尋內容',
    searchButtonAria: '搜尋',
    totalResults: '{{totalCount}} 筆結果',
    ariaPaginationGoToPage: '前往第 {{pageNumber}} 頁',
    ariaPaginationNavigation: '分頁',
  },
};

/*
 * Facet headings, keyed on the bundle's humanised field name
 * (`content_type_level0` → `Content Type`), and facet values, keyed on the value
 * the pipeline indexes (arbory-streamx mesh/sources/painless/arbory_page_fields).
 */
const HEADINGS = {
  en: { 'Content Type': 'Content type' },
  de: {
    'Content Type': 'Inhaltstyp', Topic: 'Thema', Technology: 'Technologie', Year: 'Jahr', Author: 'Autor',
  },
  es: {
    'Content Type': 'Tipo de contenido', Topic: 'Tema', Technology: 'Tecnología', Year: 'Año', Author: 'Autor',
  },
  fr: {
    'Content Type': 'Type de contenu', Topic: 'Sujet', Technology: 'Technologie', Year: 'Année', Author: 'Auteur',
  },
  it: {
    'Content Type': 'Tipo di contenuto', Topic: 'Argomento', Technology: 'Tecnologia', Year: 'Anno', Author: 'Autore',
  },
  pl: {
    'Content Type': 'Typ treści', Topic: 'Temat', Technology: 'Technologia', Year: 'Rok', Author: 'Autor',
  },
  pt: {
    'Content Type': 'Tipo de conteúdo', Topic: 'Tópico', Technology: 'Tecnologia', Year: 'Ano', Author: 'Autor',
  },
  ja: {
    'Content Type': 'コンテンツの種類', Topic: 'トピック', Technology: 'テクノロジー', Year: '年', Author: '著者',
  },
  ko: {
    'Content Type': '콘텐츠 유형', Topic: '주제', Technology: '기술', Year: '연도', Author: '작성자',
  },
  'zh-cn': {
    'Content Type': '内容类型', Topic: '主题', Technology: '技术', Year: '年份', Author: '作者',
  },
  'zh-tw': {
    'Content Type': '內容類型', Topic: '主題', Technology: '技術', Year: '年份', Author: '作者',
  },
};

const VALUE_KEYS = [
  'Article', 'Podcast', 'Customer story', 'Event', 'Page',
  'AEM Technical Help', 'AEM News', 'Arbory Digital News',
  'Performance', 'Observability', 'Replication & Publishing', 'AI & LLM Optimization',
  'Composable architecture',
];

/* One row per language, in VALUE_KEYS order. */
const VALUE_ROWS = {
  de: ['Artikel', 'Podcast', 'Kundenstory', 'Veranstaltung', 'Seite',
    'AEM – Technische Hilfe', 'AEM-News', 'Arbory Digital News',
    'Performance', 'Observability', 'Replikation & Veröffentlichung', 'KI- & LLM-Optimierung',
    'Composable-Architektur'],
  es: ['Artículo', 'Pódcast', 'Caso de cliente', 'Evento', 'Página',
    'Ayuda técnica de AEM', 'Noticias de AEM', 'Noticias de Arbory Digital',
    'Rendimiento', 'Observabilidad', 'Replicación y publicación', 'Optimización de IA y LLM',
    'Arquitectura componible'],
  fr: ['Article', 'Podcast', 'Témoignage client', 'Événement', 'Page',
    'Aide technique AEM', 'Actualités AEM', 'Actualités Arbory Digital',
    'Performance', 'Observabilité', 'Réplication et publication', 'Optimisation IA et LLM',
    'Architecture composable'],
  it: ['Articolo', 'Podcast', 'Storia di un cliente', 'Evento', 'Pagina',
    'Assistenza tecnica AEM', 'Notizie AEM', 'Notizie Arbory Digital',
    'Prestazioni', 'Osservabilità', 'Replica e pubblicazione', 'Ottimizzazione IA e LLM',
    'Architettura componibile'],
  pl: ['Artykuł', 'Podcast', 'Historia klienta', 'Wydarzenie', 'Strona',
    'Pomoc techniczna AEM', 'Aktualności AEM', 'Aktualności Arbory Digital',
    'Wydajność', 'Obserwowalność', 'Replikacja i publikacja', 'Optymalizacja AI i LLM',
    'Architektura kompozytowa'],
  pt: ['Artigo', 'Podcast', 'História de cliente', 'Evento', 'Página',
    'Ajuda técnica de AEM', 'Notícias de AEM', 'Notícias da Arbory Digital',
    'Desempenho', 'Observabilidade', 'Replicação e publicação', 'Otimização de IA e LLM',
    'Arquitetura combinável'],
  ja: ['記事', 'ポッドキャスト', '導入事例', 'イベント', 'ページ',
    'AEM 技術ヘルプ', 'AEM ニュース', 'Arbory Digital ニュース',
    'パフォーマンス', 'オブザーバビリティ', 'レプリケーションと公開', 'AI・LLM 最適化',
    'コンポーザブルアーキテクチャ'],
  ko: ['아티클', '팟캐스트', '고객 사례', '이벤트', '페이지',
    'AEM 기술 지원', 'AEM 뉴스', 'Arbory Digital 뉴스',
    '성능', '관측성', '복제 및 게시', 'AI 및 LLM 최적화',
    '컴포저블 아키텍처'],
  'zh-cn': ['文章', '播客', '客户案例', '活动', '页面',
    'AEM 技术帮助', 'AEM 新闻', 'Arbory Digital 新闻',
    '性能', '可观测性', '复制与发布', 'AI 与 LLM 优化',
    '可组合架构'],
  'zh-tw': ['文章', 'Podcast', '客戶案例', '活動', '頁面',
    'AEM 技術協助', 'AEM 新聞', 'Arbory Digital 新聞',
    '效能', '可觀測性', '複寫與發布', 'AI 與 LLM 最佳化',
    '可組合架構'],
};

/* BCP 47 tags for Intl, where the site's folder name is not one. */
const INTL_LOCALE = { en: 'en-US', 'zh-cn': 'zh-CN', 'zh-tw': 'zh-TW' };

/** The site languages this file has strings for. */
export const SEARCH_LANGUAGES = Object.keys(STRINGS);

/**
 * The page's language, as one of SEARCH_LANGUAGES; English for anything else.
 *
 * @param {string} [override] A language to use instead of the page's
 * @returns {string} e.g. 'de', 'zh-cn'
 */
export function searchLanguage(override) {
  const raw = (override ?? document.documentElement.lang ?? '').trim().toLowerCase();
  return STRINGS[raw] ? raw : 'en';
}

/** The Intl locale for the page's language, e.g. 'zh-CN'. */
export function searchLocale(lang = searchLanguage()) {
  return INTL_LOCALE[lang] || lang;
}

/**
 * A UI string for the page's language, with `{name}` placeholders filled.
 *
 * @param {string} key A key of STRINGS.en
 * @param {Object} [vars] Placeholder values
 * @param {string} [lang] Defaults to the page's language
 * @returns {string}
 */
export function t(key, vars = {}, lang = searchLanguage()) {
  const template = STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

/** A number written the page's way, e.g. 1.234 in German. */
export function formatCount(n, lang = searchLanguage()) {
  return Number(n).toLocaleString(searchLocale(lang));
}

/**
 * The bundle's label rows for the page's language.
 *
 * @param {string} [lang] Defaults to the page's language
 * @returns {Object} Row name → value
 */
export function libraryLabels(lang = searchLanguage()) {
  return { ...LIBRARY.en, ...LIBRARY[lang] };
}

/**
 * A facet heading for the page's language.
 *
 * @param {string} heading The bundle's heading, e.g. 'Content Type'
 * @returns {string|undefined} The label, or undefined to leave it as is
 */
export function facetHeading(heading, lang = searchLanguage()) {
  return HEADINGS[lang]?.[heading] ?? HEADINGS.en[heading];
}

/**
 * A facet value's label for the page's language: the indexed value when there
 * is no translation, which is right for product names.
 *
 * @param {string} value The indexed value, e.g. 'Article'
 * @returns {string}
 */
export function facetValueLabel(value, lang = searchLanguage()) {
  const at = VALUE_KEYS.indexOf(value);
  return (at !== -1 && VALUE_ROWS[lang]?.[at]) || value;
}
