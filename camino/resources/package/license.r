// See /System/Library/Frameworks/CoreServices.framework/Frameworks/CarbonCore.framework/Headers/Script.h for language IDs.
data 'LPic' (5000) {
  // Default language ID, 0 = English
  $"0000"
  // Number of entries in list
  $"0009"

  // Entry 1
  // Language ID, 0 = English
  $"0000"
  // Resource ID, 0 = STR#/TEXT/styl 5000
  $"0000"
  // Multibyte language, 0 = no
  $"0000"
  // Entry 2
  // Language ID, 1 = French
  $"0001"
  // Resource ID, 1 = STR#/TEXT/styl 5001
  $"0001"
  // Multibyte language, 0 = no
  $"0000"
  // Entry 3
  // Language ID, 3 = German
  $"0003"
  // Resource ID, 2 = STR#/TEXT/styl 5002
  $"0002"
  // Multibyte language, 0 = no
  $"0000"
  // Entry 4
  // Language ID, 4 = Italian
  $"0004"
  // Resource ID, 3 = STR#/TEXT/styl 5003
  $"0003"
  // Multibyte language, 0 = no
  $"0000"
  // Entry 5
  // Language ID, 8 = Spanish
  $"0008"
  // Resource ID, 4 = STR#/TEXT/styl 5004
  $"0004"
  // Multibyte language, 0 = no
  $"0000"
  // Entry 6
  // Language ID, 14 = Japanese
  $"000E"
  // Resource ID, 5 = STR#/TEXT/styl 5005
  $"0005"
  // Multibyte language, 1 = yes
  $"0001"
  // Entry 7
  // Language ID, 51 = Korean
  $"0033"
  // Resource ID, 6 = STR#/TEXT/styl 5006
  $"0006"
  // Multibyte language, 1 = yes
  $"0001"
  // Entry 8
  // Language ID, 52 = Simplified Chinese
  $"0034"
  // Resource ID, 7 = STR#/TEXT/styl 5007
  $"0007"
  // Multibyte language, 1 = yes
  $"0001"
  // Entry 9
  // Language ID, 53 = Traditional Chinese
  $"0035"
  // Resource ID, 8 = STR#/TEXT/styl 5008
  $"0008"
  // Multibyte language, 1 = yes
  $"0001"
};

resource 'STR#' (5000, "English") {
  {
    // Language (unused?) = English
    "English",
    // Accept (Agree)
    "Accept",
    // Decline (Disagree)
    "Decline",
    // Print, ellipsis is 0xC9
    "Print…",
    // Save As, ellipsis is 0xC9
    "Save As…",
    // Descriptive text, curly quotes are 0xD2 and 0xD3
    "You are about to install Camino.\n"
    "\n"
    "Please read the license agreement.  If you agree to its terms and accept, click “Accept” to access the software.  Otherwise, click “Decline” to cancel."
  };
};

resource 'STR#' (5001, "French") {
	{	/* array StringArray: 6 elements */
		/* [1] */
		"Français",
		/* [2] */
		"Accepter",
		/* [3] */
		"Refuser",
		/* [4] */
		"Imprimer…",
		/* [5] */
		"Enregistrer…",
		/* [6] */
		"Si vous acceptez les termes de la présen"
		"te licence, cliquez sur « Accepter » afin "
		"d'installer le logiciel. Si vous n'êtes "
		"pas d'accord avec les termes de la licen"
		"ce, cliquez sur « Refuser »."
	}
};

resource 'STR#' (5002, "German") {
	{	/* array StringArray: 6 elements */
		/* [1] */
		"Deutsch",
		/* [2] */
		"Akzeptieren",
		/* [3] */
		"Ablehnen",
		/* [4] */
		"Drucken…",
		/* [5] */
		"Sichern…",
		/* [6] */
		"Klicken Sie in “Akzeptieren”, wenn Sie m"
		"it den Bestimmungen des Software-Lizenzv"
		"ertrags einverstanden sind. Falls nicht,"
		" bitte “Ablehnen” anklicken. Sie können "
		"die Software nur installieren, wenn Sie "
		"“Akzeptieren” angeklickt haben."
	}
};

resource 'STR#' (5003, "Italian") {
	{	/* array StringArray: 6 elements */
		/* [1] */
		"Italiano",
		/* [2] */
		"Accetto",
		/* [3] */
		"Rifiuto",
		/* [4] */
		"Stampa…",
		/* [5] */
		"Registra…",
		/* [6] */
		"Se accetti le condizioni di questa licen"
		"za, fai clic su “Accetto” per installare"
		" il software. Altrimenti fai clic su “Ri"
		"fiuto”."
	}
};

resource 'STR#' (5004, "Spanish") {
	{	/* array StringArray: 6 elements */
		/* [1] */
		"Español",
		/* [2] */
		"Aceptar",
		/* [3] */
		"No aceptar",
		/* [4] */
		"Imprimir…",
		/* [5] */
		"Guardar…",
		/* [6] */
		"Si está de acuerdo con los términos de e"
		"sta licencia, pulse “Aceptar” para insta"
		"lar el software. En el supuesto de que n"
		"o esté de acuerdo con los términos de es"
		"ta licencia, pulse “No aceptar.”"
	}
};

resource 'STR#' (5005, "Japanese") {
	{	/* array StringArray: 6 elements */
		/* [1] */
		"Japanese",
		/* [2] */
		"ìØà”ÇµÇ‹Ç∑",
		/* [3] */
		"ìØà”ÇµÇ‹ÇπÇÒ",
		/* [4] */
		"àÛç¸Ç∑ÇÈ",
		/* [5] */
		"ï€ë∂...",
		/* [6] */
		"ñ{É\\ÉtÉgÉEÉGÉAégópãñë¯å_ñÒÇÃèåèÇ…ìØà”Ç≥"
		"ÇÍÇÈèÍçáÇ…ÇÕÅAÉ\\ÉtÉgÉEÉGÉAÇÉCÉìÉXÉgÅ[Éã"
		"Ç∑ÇÈÇΩÇﬂÇ…ÅuìØà”ÇµÇ‹Ç∑ÅvÇâüÇµÇƒÇ≠ÇæÇ≥Ç¢"
		"ÅBÅ@ìØà”Ç≥ÇÍÇ»Ç¢èÍçáÇ…ÇÕÅAÅuìØà”ÇµÇ‹ÇπÇÒ"
		"ÅvÇâüÇµÇƒÇ≠ÇæÇ≥Ç¢ÅB"
	}
};

resource 'STR#' (5006, "Korean") {
	{	/* array StringArray: 6 elements */
		/* [1] */
		"Korean",
		/* [2] */
		"µø¿«",
		/* [3] */
		"µø¿« æ»«‘",
		/* [4] */
		"«¡∏∞∆Æ",
		/* [5] */
		"¿˙¿Â...",
		/* [6] */
		"ªÁøÎ ∞Ëæ‡º≠¿« ≥ªøÎø° µø¿««œ∏È, \"µø¿«\" ¥‹"
		"√ﬂ∏¶ ¥≠∑Ø º“«¡∆Æø˛æÓ∏¶ º≥ƒ°«œΩ Ω√ø¿. µø¿"
		"««œ¡ˆ æ ¥¬¥Ÿ∏È, \"µø¿« æ»«‘\" ¥‹√ﬂ∏¶ ¥©∏£Ω"
		" Ω√ø¿."
	}
};

resource 'STR#' (5007, "Simplified Chinese") {
	{	/* array StringArray: 6 elements */
		/* [1] */
		"Simplified Chinese",
		/* [2] */
		"Õ¨“‚",
		/* [3] */
		"≤ªÕ¨“‚",
		/* [4] */
		"¥Ú”°",
		/* [5] */
		"¥Ê¥¢°≠",
		/* [6] */
		"»Áπ˚ƒ˙Õ¨“‚±æ–Ìø…–≠“ÈµƒÃıøÓ£¨«Î∞¥°∞Õ¨“‚°±"
		"¿¥∞≤◊∞¥À»Ìº˛°£»Áπ˚ƒ˙≤ªÕ¨“‚£¨«Î∞¥°∞≤ªÕ¨“‚"
		"°±°£"
	}
};

resource 'STR#' (5008, "Traditional Chinese") {
	{	/* array StringArray: 6 elements */
		/* [1] */
		"Traditional Chinese",
		/* [2] */
		"¶P∑N",
		/* [3] */
		"§£¶P∑N",
		/* [4] */
		"¶C¶L",
		/* [5] */
		"¿x¶s°K",
		/* [6] */
		"¶p™G±z¶P∑N•ª≥\\•i√“∏Ã™∫±¯¥⁄°AΩ–´ˆ°ß¶P∑N°®"
		"•H¶w∏À≥n≈È°C¶p™G§£¶P∑N°AΩ–´ˆ°ß§£¶P∑N°®°C"
	}
};

// Beware of 1024(?) byte (character?) line length limitation.  Split up long
// lines.
// If straight quotes are used ("), remember to escape them (\").
// Newline is \n, to leave a blank line, use two of them.
// 0xD2 and 0xD3 are curly double-quotes ("), 0xD4 and 0xD5 are curly
//   single quotes ('), 0xD5 is also the apostrophe.
data 'TEXT' (5000, "English") {
  "FOR TRANSLATIONS OF THIS LICENSE INTO SELECTED LANGUAGES, PLEASE VISIT WWW.MOZILLA.ORG/LICENSING.\n"
  "\n"
  "CAMINO END-USER SOFTWARE LICENSE AGREEMENT\n"
  "Version 1.1\n"
  "\n"
  "A SOURCE CODE VERSION OF CERTAIN CAMINO BROWSER FUNCTIONALITY THAT YOU MAY USE, MODIFY AND DISTRIBUTE IS AVAILABLE TO YOU FREE-OF-CHARGE FROM WWW.MOZILLA.ORG UNDER THE MOZILLA PUBLIC LICENSE and other open source software licenses.\n"
  "\n"
  "The accompanying executable code version of Camino and related documentation (the “Product”) is made available to you under the terms of this CAMINO END-USER SOFTWARE LICENSE AGREEMENT (THE “AGREEMENT”). BY CLICKING THE “ACCEPT” BUTTON, OR BY INSTALLING OR USING THE CAMINO BROWSER, YOU ARE CONSENTING TO BE BOUND BY THE AGREEMENT. IF YOU DO NOT AGREE TO THE TERMS AND CONDITIONS OF THIS AGREEMENT, DO NOT CLICK THE “ACCEPT” BUTTON, AND DO NOT INSTALL OR USE ANY PART OF THE CAMINO BROWSER.\n"
  "\n"
  "DURING THE CAMINO INSTALLATION PROCESS, AND AT LATER TIMES, YOU MAY BE GIVEN THE OPTION OF INSTALLING ADDITIONAL COMPONENTS FROM THIRD-PARTY SOFTWARE PROVIDERS. THE INSTALLATION AND USE OF THOSE THIRD-PARTY COMPONENTS MAY BE GOVERNED BY ADDITIONAL LICENSE AGREEMENTS.\n"
  "\n"
  "1. LICENSE GRANT. The Mozilla Foundation grants you a non-exclusive license to use the executable code version of the Product. This Agreement will also govern any software upgrades provided by Mozilla that replace and/or supplement the original Product, unless such upgrades are accompanied by a separate license, in which case the terms of that license will govern.\n"
  "\n"
  "2. TERMINATION. If you breach this Agreement your right to use the Product will terminate immediately and without notice, but all provisions of this Agreement except the License Grant (Paragraph 1) will survive termination and continue in effect. Upon termination, you must destroy all copies of the Product.\n"
  "\n"
  "3. PROPRIETARY RIGHTS. Portions of the Product are available in source code form under the terms of the Mozilla Public License and other open source licenses (collectively, “Open Source Licenses”) at http://www.mozilla.org. Nothing in this Agreement will be construed to limit any rights granted under the Open Source Licenses. Subject to the foregoing, Mozilla, for itself and on behalf of its licensors, hereby reserves all intellectual property rights in the Product, except for the rights expressly granted in this Agreement. You may not remove or alter any trademark, logo, copyright or other proprietary notice in or on the Product. This license does not grant you any right to use the trademarks, service marks or logos of Mozilla or its licensors.\n"
  "\n"
  "4. DISCLAIMER OF WARRANTY. THE PRODUCT IS PROVIDED “AS IS” WITH ALL FAULTS. TO THE EXTENT PERMITTED BY LAW, MOZILLA AND MOZILLA’S DISTRIBUTORS, LICENSORS HEREBY DISCLAIM ALL WARRANTIES, WHETHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION WARRANTIES THAT THE PRODUCT IS FREE OF DEFECTS, MERCHANTABLE, FIT FOR A PARTICULAR PURPOSE AND NON-INFRINGING. YOU BEAR ENTIRE RISK AS TO SELECTING THE PRODUCT FOR YOUR PURPOSES AND AS TO THE QUALITY AND PERFORMANCE OF THE PRODUCT. THIS LIMITATION WILL APPLY NOTWITHSTANDING THE FAILURE OF ESSENTIAL PURPOSE OF ANY REMEDY. SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OR LIMITATION OF IMPLIED WARRANTIES, SO THIS DISCLAIMER MAY NOT APPLY TO YOU.\n"
  "\n"
  "5. LIMITATION OF LIABILITY. EXCEPT AS REQUIRED BY LAW, MOZILLA AND ITS DISTRIBUTORS, DIRECTORS, LICENSORS, CONTRIBUTORS AND AGENTS (COLLECTIVELY, THE “MOZILLA GROUP”) WILL NOT BE LIABLE FOR ANY INDIRECT, SPECIAL, INCIDENTAL, CONSEQUENTIAL OR EXEMPLARY DAMAGES ARISING OUT OF OR IN ANY WAY RELATING TO THIS AGREEMENT OR THE USE OF OR INABILITY TO USE THE PRODUCT, INCLUDING WITHOUT LIMITATION DAMAGES FOR LOSS OF GOODWILL, WORK STOPPAGE, LOST PROFITS, LOSS OF DATA, AND COMPUTER FAILURE OR MALFUNCTION, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES AND REGARDLESS OF THE THEORY (CONTRACT, TORT OR OTHERWISE) UPON WHICH SUCH CLAIM IS BASED. THE MOZILLA GROUP’S COLLECTIVE LIABILITY UNDER THIS AGREEMENT WILL NOT EXCEED THE GREATER OF $500 (FIVE HUNDRED DOLLARS) AND THE FEES PAID BY YOU UNDER THIS LICENSE (IF ANY). SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OR LIMITATION OF INCIDENTAL, CONSEQUENTIAL OR SPECIAL DAMAGES, SO THIS EXCLUSION AND LIMITATION MAY NOT APPLY TO YOU.\n"
  "\n"
  "6. EXPORT CONTROLS. This license is subject to all applicable export restrictions. You must comply with all export and import laws and restrictions and regulations of any United States or foreign agency or authority relating to the Product and its use.\n"
  "\n"
  "7. U.S. GOVERNMENT END-USERS. The Product is a “commercial item,” as that term is defined in 48 C.F.R. 2.101, consisting of “commercial computer software” and “commercial computer software documentation,” as such terms are used in 48 C.F.R. 12.212 (Sept. 1995) and 48 C.F.R. 227.7202 (June 1995). Consistent with 48 C.F.R. 12.212, 48 C.F.R. 27.405(b)(2) (June 1998) and 48 C.F.R. 227.7202, all U.S. Government End Users acquire the Product with only those rights as set forth herein.\n"
  "\n"
  "8. MISCELLANEOUS. (a) This Agreement constitutes the entire agreement between Mozilla and you concerning the subject matter hereof, and it may only be modified by a written amendment signed by an authorized executive of Mozilla. (b) Except to the extent applicable law, if any, provides otherwise, this Agreement will be governed by the laws of the state of California, U.S.A., excluding its conflict of law provisions. (c) This Agreement will not be governed by the United Nations Convention on Contracts for the International Sale of Goods. (d) If any part of this Agreement is held invalid or unenforceable, that part will be construed to reflect the parties’ original intent, and the remaining portions will remain in full force and effect. "
  "(e) A waiver by either party of any term or condition of this Agreement or any breach thereof, in any one instance, will not waive such term or condition or any subsequent breach thereof. (f) Except as required by law, the controlling language of this Agreement is English. (g) You may assign your rights under this Agreement to any party that consents to, and agrees to be bound by, its terms; the Mozilla Foundation may assign its rights under this Agreement without condition. (h) This Agreement will be binding upon and will inure to the benefit of the parties, their successors and permitted assigns."
};

data 'styl' (5000, "English") {
  // Number of styles following = 3
  $"0003"

  // Style 1.  This is used to display the message about translations.
  // Start character = 0
  $"0000 0000"
  // Height = 16
  $"0010"
  // Ascent = 12
  $"000C"
  // Font family = 1024 (Lucida Grande)
  $"0400"
  // Style bitfield, 0x1=bold 0x2=italic 0x4=underline 0x8=outline
  // 0x10=shadow 0x20=condensed 0x40=extended
  $"00"
  // Style, unused?
  $"02"
  // Size = 12 point
  $"000C"
  // Color, RGB
  $"0000 0000 0000"

  // Style 2.  This is used to display the header lines in bold text.
  // Start character = 99
  $"0000 0063"
  // Height = 16
  $"0010"
  // Ascent = 12
  $"000C"
  // Font family = 1024 (Lucida Grande)
  $"0400"
  // Style bitfield, 0x1=bold 0x2=italic 0x4=underline 0x8=outline
  // 0x10=shadow 0x20=condensed 0x40=extended
  $"01"
  // Style, unused?
  $"02"
  // Size = 12 point
  $"000C"
  // Color, RGB
  $"0000 0000 0000"

  // Style 3.  This is used to display the body.
  // Start character = 142
  $"0000 008E"
  // Height = 16
  $"0010"
  // Ascent = 12
  $"000C"
  // Font family = 1024 (Lucida Grande)
  $"0400"
  // Style bitfield, 0x1=bold 0x2=italic 0x4=underline 0x8=outline
  // 0x10=shadow 0x20=condensed 0x40=extended
  $"00"
  // Style, unused?
  $"02"
  // Size = 12 point
  $"000C"
  // Color, RGB
  $"0000 0000 0000"
};

data 'TEXT' (5001, "French SLA") {
	$"4365 2074 6578 7465 2065 7374 2075 6E65"            /* Ce texte est une */
	$"2074 7261 6475 6374 696F 6E20 6F66 6669"            /*  traduction offi */
	$"6369 6575 7365 2065 6E20 6672 616E 8D61"            /* cieuse en frança */
	$"6973 2064 7520 636F 6E74 7261 7420 6465"            /* is du contrat de */
	$"206C 6963 656E 6365 2064 D575 7469 6C69"            /*  licence d’utili */
	$"7361 7469 6F6E 2064 7520 6C6F 6769 6369"            /* sation du logici */
	$"656C 2043 414D 494E 4F2E 2043 6574 7465"            /* el CAMINO. Cette */
	$"2074 7261 6475 6374 696F 6E20 6465 7320"            /*  traduction des  */
	$"636F 6E64 6974 696F 6E73 2064 6520 6C69"            /* conditions de li */
	$"6365 6E63 6520 6465 206C 6120 7072 8E73"            /* cence de la prés */
	$"656E 7465 2063 6F70 6965 2064 6520 4341"            /* ente copie de CA */
	$"4D49 4E4F 206E D561 2070 6173 2076 616C"            /* MINO n’a pas val */
	$"6575 7220 6A75 7269 6469 7175 652C 2063"            /* eur juridique, c */
	$"656C 6C65 2D63 6920 6573 7420 6CD5 6578"            /* elle-ci est l’ex */
	$"636C 7573 6976 6974 8E20 6465 206C D56F"            /* clusivité de l’o */
	$"7269 6769 6E61 6C20 656E 2061 6E67 6C61"            /* riginal en angla */
	$"6973 2E20 546F 7574 6566 6F69 732C 206E"            /* is. Toutefois, n */
	$"6F75 7320 6573 708E 726F 6E73 2071 7565"            /* ous espérons que */
	$"2063 6574 7465 2074 7261 6475 6374 696F"            /*  cette traductio */
	$"6E20 6169 6465 7261 206C 6573 2075 7469"            /* n aidera les uti */
	$"6C69 7361 7465 7572 7320 6672 616E 636F"            /* lisateurs franco */
	$"7068 6F6E 6573 2088 206D 6965 7578 2063"            /* phones à mieux c */
	$"6F6D 7072 656E 6472 6520 6C65 2063 6F6E"            /* omprendre le con */
	$"7472 6174 2064 6520 6C69 6365 6E63 6520"            /* trat de licence  */
	$"64D5 7574 696C 6973 6174 696F 6E20 6475"            /* d’utilisation du */
	$"206C 6F67 6963 6965 6C20 4341 4D49 4E4F"            /*  logiciel CAMINO */
	$"2E0D 0D43 4F4E 5452 4154 2044 4520 4C49"            /* ...CONTRAT DE LI */
	$"4345 4E43 4520 44D5 5554 494C 4953 4154"            /* CENCE D’UTILISAT */
	$"494F 4E20 4455 204C 4F47 4943 4945 4C20"            /* ION DU LOGICIEL  */
	$"4341 4D49 4E4F 0D56 6572 7369 6F6E 2031"            /* CAMINO.Version 1 */
	$"2E31 0D0D 554E 4520 5645 5253 494F 4E20"            /* .1..UNE VERSION  */
	$"454E 2043 4F44 4520 534F 5552 4345 2044"            /* EN CODE SOURCE D */
	$"4520 4345 5254 4149 4E45 5320 464F 4E43"            /* E CERTAINES FONC */
	$"5449 4F4E 5320 4455 204E 4156 4947 4154"            /* TIONS DU NAVIGAT */
	$"4555 5220 4341 4D49 4E4F 2051 5545 2056"            /* EUR CAMINO QUE V */
	$"4F55 5320 504F 5556 455A 2055 5449 4C49"            /* OUS POUVEZ UTILI */
	$"5345 522C 204D 4F44 4946 4945 5220 4554"            /* SER, MODIFIER ET */
	$"2044 4953 5452 4942 5545 5220 564F 5553"            /*  DISTRIBUER VOUS */
	$"2045 5354 204F 4646 4552 5445 2047 5241"            /*  EST OFFERTE GRA */
	$"5455 4954 454D 454E 5420 5355 5220 4C45"            /* TUITEMENT SUR LE */
	$"2053 4954 4520 5757 572E 4D4F 5A49 4C4C"            /*  SITE WWW.MOZILL */
	$"412E 4F52 472C 2053 454C 4F4E 204C 4553"            /* A.ORG, SELON LES */
	$"204D 4F44 414C 4954 4553 2044 4520 4C41"            /*  MODALITES DE LA */
	$"204C 4943 454E 4345 2050 5542 4C49 5155"            /*  LICENCE PUBLIQU */
	$"4520 4D4F 5A49 4C4C 4120 6574 2064 D561"            /* E MOZILLA et d’a */
	$"7574 7265 7320 6C69 6365 6E63 6573 2064"            /* utres licences d */
	$"D575 7469 6C69 7361 7469 6F6E 2064 6520"            /* ’utilisation de  */
	$"6C6F 6769 6369 656C 7320 6C69 6272 6573"            /* logiciels libres */
	$"2E0D 0D4C 6120 7665 7273 696F 6E20 656E"            /* ...La version en */
	$"2063 6F64 6520 6578 8E63 7574 6162 6C65"            /*  code exécutable */
	$"206A 6F69 6E74 6520 6465 2043 414D 494E"            /*  jointe de CAMIN */
	$"4F20 6574 206C 6573 2064 6F63 756D 656E"            /* O et les documen */
	$"7473 2061 7373 6F63 698E 7320 286C 6520"            /* ts associés (le  */
	$"C720 6C6F 6769 6369 656C 20C8 2920 736F"            /* « logiciel ») so */
	$"6E74 206D 6973 2088 2076 6F74 7265 2064"            /* nt mis à votre d */
	$"6973 706F 7369 7469 6F6E 2073 656C 6F6E"            /* isposition selon */
	$"206C 6573 206D 6F64 616C 6974 8E73 2064"            /*  les modalités d */
	$"7520 7072 8E73 656E 7420 434F 4E54 5241"            /* u présent CONTRA */
	$"5420 4445 204C 4943 454E 4345 2044 D555"            /* T DE LICENCE D’U */
	$"5449 4C49 5341 5449 4F4E 2044 5520 4C4F"            /* TILISATION DU LO */
	$"4749 4349 454C 2043 414D 494E 4F20 284C"            /* GICIEL CAMINO (L */
	$"4520 C720 434F 4E54 5241 5420 C829 2E20"            /* E « CONTRAT »).  */
	$"454E 2043 4C49 5155 414E 5420 5355 5220"            /* EN CLIQUANT SUR  */
	$"4C45 2042 4F55 544F 4E20 C720 4AD5 4143"            /* LE BOUTON « J’AC */
	$"4345 5054 4520 C82C 204F 5520 454E 2049"            /* CEPTE », OU EN I */
	$"4E53 5441 4C4C 414E 5420 4F55 2045 4E20"            /* NSTALLANT OU EN  */
	$"5554 494C 4953 414E 5420 4C45 204E 4156"            /* UTILISANT LE NAV */
	$"4947 4154 4555 5220 4341 4D49 4E4F 2C20"            /* IGATEUR CAMINO,  */
	$"564F 5553 2043 4F4E 5345 4E54 455A 2041"            /* VOUS CONSENTEZ A */
	$"2045 5452 4520 4C49 4520 5041 5220 4C45"            /*  ETRE LIE PAR LE */
	$"2043 4F4E 5452 4154 2E20 5349 2056 4F55"            /*  CONTRAT. SI VOU */
	$"5320 4ED5 4143 4345 5054 455A 2050 4153"            /* S N’ACCEPTEZ PAS */
	$"204C 4553 204D 4F44 414C 4954 4553 2045"            /*  LES MODALITES E */
	$"5420 434F 4E44 4954 494F 4E53 2044 5520"            /* T CONDITIONS DU  */
	$"5052 4553 454E 5420 434F 4E54 5241 542C"            /* PRESENT CONTRAT, */
	$"204E 4520 434C 4951 5545 5A20 5041 5320"            /*  NE CLIQUEZ PAS  */
	$"5355 5220 4C45 2042 4F55 544F 4E20 C720"            /* SUR LE BOUTON «  */
	$"4AD5 4143 4345 5054 4520 C820 4554 204E"            /* J’ACCEPTE » ET N */
	$"D549 4E53 5441 4C4C 455A 204E 4920 4ED5"            /* ’INSTALLEZ NI N’ */
	$"5554 494C 4953 455A 2041 5543 554E 4520"            /* UTILISEZ AUCUNE  */
	$"5041 5254 4945 2044 5520 4E41 5649 4741"            /* PARTIE DU NAVIGA */
	$"5445 5552 2043 414D 494E 4F2E 2041 5520"            /* TEUR CAMINO. AU  */
	$"434F 5552 5320 4455 2050 524F 4345 5353"            /* COURS DU PROCESS */
	$"5553 2044 D549 4E53 5441 4C4C 4154 494F"            /* US D’INSTALLATIO */
	$"4E20 4445 2043 414D 494E 4F20 4554 2055"            /* N DE CAMINO ET U */
	$"4C54 4552 4945 5552 454D 454E 542C 204C"            /* LTERIEUREMENT, L */
	$"4120 504F 5353 4942 494C 4954 4520 44D5"            /* A POSSIBILITE D’ */
	$"494E 5354 414C 4C45 5220 4445 5320 434F"            /* INSTALLER DES CO */
	$"4D50 4F53 414E 5453 2053 5550 504C 454D"            /* MPOSANTS SUPPLEM */
	$"454E 5441 4952 4553 2050 524F 5645 4E41"            /* ENTAIRES PROVENA */
	$"4E54 2044 4520 464F 5552 4E49 5353 4555"            /* NT DE FOURNISSEU */
	$"5253 2044 4520 4C4F 4749 4349 454C 5320"            /* RS DE LOGICIELS  */
	$"5449 4552 5320 5045 5554 2056 4F55 5320"            /* TIERS PEUT VOUS  */
	$"4554 5245 204F 4646 4552 5445 2E20 4CD5"            /* ETRE OFFERTE. L’ */
	$"494E 5354 414C 4C41 5449 4F4E 2045 5420"            /* INSTALLATION ET  */
	$"4CD5 5554 494C 4953 4154 494F 4E20 4445"            /* L’UTILISATION DE */
	$"2043 4553 2043 4F4D 504F 5341 4E54 5320"            /*  CES COMPOSANTS  */
	$"5449 4552 5320 5045 5556 454E 5420 4554"            /* TIERS PEUVENT ET */
	$"5245 2052 4547 4945 5320 5041 5220 4445"            /* RE REGIES PAR DE */
	$"5320 434F 4E54 5241 5453 2044 4520 4C49"            /* S CONTRATS DE LI */
	$"4345 4E43 4520 5355 5050 4C45 4D45 4E54"            /* CENCE SUPPLEMENT */
	$"4149 5245 532E 0D0D 312E 204F 4354 524F"            /* AIRES...1. OCTRO */
	$"4920 4445 204C 4943 454E 4345 2E20 4D6F"            /* I DE LICENCE. Mo */
	$"7A69 6C6C 6120 466F 756E 6461 7469 6F6E"            /* zilla Foundation */
	$"2076 6F75 7320 6F63 7472 6F69 6520 756E"            /*  vous octroie un */
	$"6520 6C69 6365 6E63 6520 6E6F 6E20 6578"            /* e licence non ex */
	$"636C 7573 6976 6520 766F 7573 2061 7574"            /* clusive vous aut */
	$"6F72 6973 616E 7420 8820 7574 696C 6973"            /* orisant à utilis */
	$"6572 206C 6120 7665 7273 696F 6E20 656E"            /* er la version en */
	$"2063 6F64 6520 6578 8E63 7574 6162 6C65"            /*  code exécutable */
	$"2064 7520 6C6F 6769 6369 656C 2E20 4365"            /*  du logiciel. Ce */
	$"2063 6F6E 7472 6174 2072 8E67 6974 208E"            /*  contrat régit é */
	$"6761 6C65 6D65 6E74 2074 6F75 7465 206D"            /* galement toute m */
	$"6973 6520 8820 6A6F 7572 2066 6F75 726E"            /* ise à jour fourn */
	$"6965 2070 6172 204D 6F7A 696C 6C61 2C20"            /* ie par Mozilla,  */
	$"7175 6920 7265 6D70 6C61 6365 7261 6974"            /* qui remplacerait */
	$"2065 742F 6F75 2063 6F6D 706C 8E74 6572"            /*  et/ou compléter */
	$"6169 7420 6C65 206C 6F67 6963 6965 6C20"            /* ait le logiciel  */
	$"6F72 6967 696E 616C 2C20 7361 7566 2073"            /* original, sauf s */
	$"6920 756E 6520 7465 6C6C 6520 6D69 7365"            /* i une telle mise */
	$"2088 206A 6F75 7220 6465 7661 6974 2073"            /*  à jour devait s */
	$"D561 6363 6F6D 7061 676E 6572 2064 D575"            /* ’accompagner d’u */
	$"6E65 206C 6963 656E 6365 2064 6973 7469"            /* ne licence disti */
	$"6E63 7465 2C20 6175 7175 656C 2063 6173"            /* ncte, auquel cas */
	$"206C 6573 206D 6F64 616C 6974 8E73 2064"            /*  les modalités d */
	$"6520 6365 7474 6520 6C69 6365 6E63 6520"            /* e cette licence  */
	$"7072 8E76 6175 6472 6169 656E 742E 0D0D"            /* prévaudraient... */
	$"322E 2052 4553 494C 4941 5449 4F4E 2E20"            /* 2. RESILIATION.  */
	$"456E 2063 6173 2064 6520 6E6F 6E20 7265"            /* En cas de non re */
	$"7370 6563 7420 6465 7320 6469 7370 6F73"            /* spect des dispos */
	$"6974 696F 6E73 2064 7520 7072 8E73 656E"            /* itions du présen */
	$"7420 636F 6E74 7261 742C 2076 6F74 7265"            /* t contrat, votre */
	$"2064 726F 6974 2064 D575 7469 6C69 7361"            /*  droit d’utilisa */
	$"7469 6F6E 2064 7520 6C6F 6769 6369 656C"            /* tion du logiciel */
	$"2073 6572 6120 728E 7369 6C69 8E20 696D"            /*  sera résilié im */
	$"6D8E 6469 6174 656D 656E 7420 6574 2073"            /* médiatement et s */
	$"616E 7320 7072 8E61 7669 732C 206D 6169"            /* ans préavis, mai */
	$"7320 746F 7574 6573 206C 6573 2064 6973"            /* s toutes les dis */
	$"706F 7369 7469 6F6E 7320 6475 2063 6F6E"            /* positions du con */
	$"7472 6174 2C20 8820 6CD5 6578 6365 7074"            /* trat, à l’except */
	$"696F 6E20 6465 206C D56F 6374 726F 6920"            /* ion de l’octroi  */
	$"6465 206C 6963 656E 6365 2028 7061 7261"            /* de licence (para */
	$"6772 6170 6865 2031 292C 2072 6573 7465"            /* graphe 1), reste */
	$"726F 6E74 2065 6E20 7669 6775 6575 7220"            /* ront en vigueur  */
	$"6D90 6D65 2061 7072 8F73 2063 6574 7465"            /* même après cette */
	$"2072 8E73 696C 6961 7469 6F6E 2E20 456E"            /*  résiliation. En */
	$"2063 6173 2064 6520 728E 7369 6C69 6174"            /*  cas de résiliat */
	$"696F 6E2C 2076 6F75 7320 6465 7665 7A20"            /* ion, vous devez  */
	$"648E 7472 7569 7265 2074 6F75 7465 7320"            /* détruire toutes  */
	$"6C65 7320 636F 7069 6573 2064 7520 6C6F"            /* les copies du lo */
	$"6769 6369 656C 2E0D 0D33 2E20 4452 4F49"            /* giciel...3. DROI */
	$"5453 2044 4520 5052 4F50 5249 4554 452E"            /* TS DE PROPRIETE. */
	$"2043 6572 7461 696E 6573 2070 6172 7469"            /*  Certaines parti */
	$"6573 2064 7520 6C6F 6769 6369 656C 2073"            /* es du logiciel s */
	$"6F6E 7420 6469 7370 6F6E 6962 6C65 7320"            /* ont disponibles  */
	$"736F 7573 2066 6F72 6D65 2064 6520 636F"            /* sous forme de co */
	$"6465 2073 6F75 7263 6520 7365 6C6F 6E20"            /* de source selon  */
	$"6C65 7320 6D6F 6461 6C69 748E 7320 6465"            /* les modalités de */
	$"206C 6120 6C69 6365 6E63 6520 7075 626C"            /*  la licence publ */
	$"6971 7565 204D 6F7A 696C 6C61 2065 7420"            /* ique Mozilla et  */
	$"64D5 6175 7472 6573 206C 6963 656E 6365"            /* d’autres licence */
	$"7320 64D5 7574 696C 6973 6174 696F 6E20"            /* s d’utilisation  */
	$"6465 206C 6F67 6963 6965 6C73 206C 6962"            /* de logiciels lib */
	$"7265 7320 2863 6F6C 6C65 6374 6976 656D"            /* res (collectivem */
	$"656E 742C 206C 6573 20C7 206C 6963 656E"            /* ent, les « licen */
	$"6365 7320 64D5 7574 696C 6973 6174 696F"            /* ces d’utilisatio */
	$"6E20 6465 206C 6F67 6963 6965 6C73 206C"            /* n de logiciels l */
	$"6962 7265 7320 C829 2C20 7375 7220 6C65"            /* ibres »), sur le */
	$"2073 6974 6520 6874 7470 3A2F 2F77 7777"            /*  site http://www */
	$"2E6D 6F7A 696C 6C61 2E6F 7267 2E20 4175"            /* .mozilla.org. Au */
	$"6375 6E65 2064 6973 706F 7369 7469 6F6E"            /* cune disposition */
	$"2064 7520 7072 8E73 656E 7420 636F 6E74"            /*  du présent cont */
	$"7261 7420 6E65 2064 6F69 7420 9074 7265"            /* rat ne doit être */
	$"2069 6E74 6572 7072 8E74 8E65 2064 6520"            /*  interprétée de  */
	$"6D61 6E69 8F72 6520 8820 6C69 6D69 7465"            /* manière à limite */
	$"7220 7175 656C 7175 6520 6472 6F69 7420"            /* r quelque droit  */
	$"7175 6520 6365 2073 6F69 742C 2067 6172"            /* que ce soit, gar */
	$"616E 7469 2064 616E 7320 6C65 2063 6164"            /* anti dans le cad */
	$"7265 2064 6573 206C 6963 656E 6365 7320"            /* re des licences  */
	$"64D5 7574 696C 6973 6174 696F 6E20 6465"            /* d’utilisation de */
	$"206C 6F67 6963 6965 6C73 206C 6962 7265"            /*  logiciels libre */
	$"732E 2053 6F75 7320 728E 7365 7276 6520"            /* s. Sous réserve  */
	$"6465 2063 6520 7175 6920 7072 8E63 8F64"            /* de ce qui précèd */
	$"652C 204D 6F7A 696C 6C61 2C20 656E 2073"            /* e, Mozilla, en s */
	$"6F6E 2070 726F 7072 6520 6E6F 6D20 6574"            /* on propre nom et */
	$"2061 7520 6E6F 6D20 6465 2073 6573 2064"            /*  au nom de ses d */
	$"6F6E 6E65 7572 7320 6465 206C 6963 656E"            /* onneurs de licen */
	$"6365 2C20 7365 2072 8E73 6572 7665 2070"            /* ce, se réserve p */
	$"6172 206C 6120 7072 8E73 656E 7465 2074"            /* ar la présente t */
	$"6F75 7320 6C65 7320 6472 6F69 7473 2064"            /* ous les droits d */
	$"6520 7072 6F70 7269 8E74 8E20 696E 7465"            /* e propriété inte */
	$"6C6C 6563 7475 656C 6C65 2063 6F6E 6365"            /* llectuelle conce */
	$"726E 616E 7420 6C65 206C 6F67 6963 6965"            /* rnant le logicie */
	$"6C2C 2088 206C D565 7863 6570 7469 6F6E"            /* l, à l’exception */
	$"2064 6573 2064 726F 6974 7320 6578 7072"            /*  des droits expr */
	$"6573 738E 6D65 6E74 206F 6374 726F 798E"            /* essément octroyé */
	$"7320 6461 6E73 206C 6520 7072 8E73 656E"            /* s dans le présen */
	$"7420 636F 6E74 7261 742E 2056 6F75 7320"            /* t contrat. Vous  */
	$"6E65 2064 6576 657A 206E 6920 656E 6C65"            /* ne devez ni enle */
	$"7665 7220 6E69 206D 6F64 6966 6965 7220"            /* ver ni modifier  */
	$"7175 656C 7175 6520 6D61 7271 7565 2064"            /* quelque marque d */
	$"6520 636F 6D6D 6572 6365 2C20 6C6F 676F"            /* e commerce, logo */
	$"2C20 636F 7079 7269 6768 7420 6F75 2061"            /* , copyright ou a */
	$"7574 7265 2061 7669 7320 7265 6C61 7469"            /* utre avis relati */
	$"6620 6175 2064 726F 6974 2064 6520 7072"            /* f au droit de pr */
	$"6F70 7269 8E74 8E20 7175 6520 6365 2073"            /* opriété que ce s */
	$"6F69 742C 2070 728E 7365 6E74 2064 616E"            /* oit, présent dan */
	$"7320 6F75 2073 7572 206C 6520 6C6F 6769"            /* s ou sur le logi */
	$"6369 656C 2E20 4365 7474 6520 6C69 6365"            /* ciel. Cette lice */
	$"6E63 6520 6E65 2076 6F75 7320 646F 6E6E"            /* nce ne vous donn */
	$"6520 6175 6375 6E20 6472 6F69 7420 64D5"            /* e aucun droit d’ */
	$"7574 696C 6973 6572 206C 6573 206D 6172"            /* utiliser les mar */
	$"7175 6573 2064 6520 636F 6D6D 6572 6365"            /* ques de commerce */
	$"2C20 6D61 7271 7565 7320 6465 2073 6572"            /* , marques de ser */
	$"7669 6365 206F 7520 6C6F 676F 7320 6465"            /* vice ou logos de */
	$"204D 6F7A 696C 6C61 206F 7520 6465 2073"            /*  Mozilla ou de s */
	$"6573 2064 6F6E 6E65 7572 7320 6465 206C"            /* es donneurs de l */
	$"6963 656E 6365 2E0D 0D34 2E20 4558 4F4E"            /* icence...4. EXON */
	$"4552 4154 494F 4E20 4445 2047 4152 414E"            /* ERATION DE GARAN */
	$"5449 452E 204C 4520 4C4F 4749 4349 454C"            /* TIE. LE LOGICIEL */
	$"2045 5354 2046 4F55 524E 4920 C720 454E"            /*  EST FOURNI « EN */
	$"204C D545 5441 5420 C820 4554 2041 5645"            /*  L’ETAT » ET AVE */
	$"4320 544F 5553 2053 4553 2044 4546 4155"            /* C TOUS SES DEFAU */
	$"5453 2E20 4441 4E53 204C 4120 4D45 5355"            /* TS. DANS LA MESU */
	$"5245 2050 4552 4D49 5345 2050 4152 204C"            /* RE PERMISE PAR L */
	$"4120 4C4F 492C 204D 4F5A 494C 4C41 2045"            /* A LOI, MOZILLA E */
	$"5420 4C45 5320 4449 5354 5249 4255 5445"            /* T LES DISTRIBUTE */
	$"5552 5320 4554 2044 4F4E 4E45 5552 5320"            /* URS ET DONNEURS  */
	$"4445 204C 4943 454E 4345 2044 4520 4D4F"            /* DE LICENCE DE MO */
	$"5A49 4C4C 4120 4445 434C 4152 454E 5420"            /* ZILLA DECLARENT  */
	$"5041 5220 4C41 2050 5245 5345 4E54 4520"            /* PAR LA PRESENTE  */
	$"4ED5 4F46 4652 4952 2041 5543 554E 4520"            /* N’OFFRIR AUCUNE  */
	$"4741 5241 4E54 4945 2C20 4558 5052 4553"            /* GARANTIE, EXPRES */
	$"5345 204F 5520 5441 4349 5445 2C20 5920"            /* SE OU TACITE, Y  */
	$"434F 4D50 5249 5320 4D41 4953 2053 414E"            /* COMPRIS MAIS SAN */
	$"5320 53D5 5920 4C49 4D49 5445 522C 204C"            /* S S’Y LIMITER, L */
	$"4553 2047 4152 414E 5449 4553 2041 5353"            /* ES GARANTIES ASS */
	$"5552 414E 5420 5155 4520 4C45 204C 4F47"            /* URANT QUE LE LOG */
	$"4943 4945 4C20 4553 5420 4558 454D 5054"            /* ICIEL EST EXEMPT */
	$"2044 4520 4445 4641 5554 532C 2043 4F4D"            /*  DE DEFAUTS, COM */
	$"4D45 5243 4941 4C49 5341 424C 452C 2041"            /* MERCIALISABLE, A */
	$"4441 5054 4520 4120 554E 2055 5341 4745"            /* DAPTE A UN USAGE */
	$"2050 4152 5449 4355 4C49 4552 2045 5420"            /*  PARTICULIER ET  */
	$"434F 4E46 4F52 4D45 2041 5558 2052 4547"            /* CONFORME AUX REG */
	$"4C45 5320 4445 2050 524F 5052 4945 5445"            /* LES DE PROPRIETE */
	$"2049 4E54 454C 4C45 4354 5545 4C4C 452E"            /*  INTELLECTUELLE. */
	$"2056 4F55 5320 4153 5355 4D45 5A20 4CD5"            /*  VOUS ASSUMEZ L’ */
	$"454E 5449 4552 4520 5245 5350 4F4E 5341"            /* ENTIERE RESPONSA */
	$"4249 4C49 5445 2044 4553 2052 4953 5155"            /* BILITE DES RISQU */
	$"4553 2045 4E43 4F55 5255 5320 454E 2043"            /* ES ENCOURUS EN C */
	$"484F 4953 4953 5341 4E54 204C 4520 4C4F"            /* HOISISSANT LE LO */
	$"4749 4349 454C 2050 4F55 5220 4C45 5320"            /* GICIEL POUR LES  */
	$"5553 4147 4553 2051 5545 2056 4F55 5320"            /* USAGES QUE VOUS  */
	$"564F 554C 455A 2045 4E20 4641 4952 4520"            /* VOULEZ EN FAIRE  */
	$"4554 2045 4741 4C45 4D45 4E54 2045 4E20"            /* ET EGALEMENT EN  */
	$"4345 2051 5549 2043 4F4E 4345 524E 4520"            /* CE QUI CONCERNE  */
	$"4C41 2051 5541 4C49 5445 2045 5420 4C45"            /* LA QUALITE ET LE */
	$"5320 5045 5246 4F52 4D41 4E43 4553 2044"            /* S PERFORMANCES D */
	$"5520 4C4F 4749 4349 454C 2E20 4345 5454"            /* U LOGICIEL. CETT */
	$"4520 5245 5354 5249 4354 494F 4E20 53D5"            /* E RESTRICTION S’ */
	$"4150 504C 4951 5545 204E 4F4E 4F42 5354"            /* APPLIQUE NONOBST */
	$"414E 5420 4CD5 494E 4144 4150 5441 4249"            /* ANT L’INADAPTABI */
	$"4C49 5445 2044 4520 544F 5554 4520 534F"            /* LITE DE TOUTE SO */
	$"4C55 5449 4F4E 2041 5050 4F52 5445 452E"            /* LUTION APPORTEE. */
	$"2043 4552 5441 494E 4553 204A 5552 4944"            /*  CERTAINES JURID */
	$"4943 5449 4F4E 5320 4E45 2050 4552 4D45"            /* ICTIONS NE PERME */
	$"5454 454E 5420 5041 5320 4CD5 4558 434C"            /* TTENT PAS L’EXCL */
	$"5553 494F 4E20 4F55 204C 4120 5245 5354"            /* USION OU LA REST */
	$"5249 4354 494F 4E20 4445 5320 4741 5241"            /* RICTION DES GARA */
	$"4E54 4945 5320 5441 4349 5445 532C 2043"            /* NTIES TACITES, C */
	$"4554 5445 2045 584F 4E45 5241 5449 4F4E"            /* ETTE EXONERATION */
	$"2044 4520 4741 5241 4E54 4945 2050 4555"            /*  DE GARANTIE PEU */
	$"5420 444F 4E43 204E 4520 5041 5320 564F"            /* T DONC NE PAS VO */
	$"5553 2045 5452 4520 4150 504C 4943 4142"            /* US ETRE APPLICAB */
	$"4C45 2E0D 0D35 2E20 4C49 4D49 5441 5449"            /* LE...5. LIMITATI */
	$"4F4E 2044 4520 5245 5350 4F4E 5341 4249"            /* ON DE RESPONSABI */
	$"4C49 5445 2E20 5341 5546 204F 424C 4947"            /* LITE. SAUF OBLIG */
	$"4154 494F 4E20 4C45 4741 4C45 2C20 4D4F"            /* ATION LEGALE, MO */
	$"5A49 4C4C 4120 4554 2053 4553 2044 4953"            /* ZILLA ET SES DIS */
	$"5452 4942 5554 4555 5253 2C20 4144 4D49"            /* TRIBUTEURS, ADMI */
	$"4E49 5354 5241 5445 5552 532C 2044 4F4E"            /* NISTRATEURS, DON */
	$"4E45 5552 5320 4445 204C 4943 454E 4345"            /* NEURS DE LICENCE */
	$"2C20 434F 4C4C 4142 4F52 4154 4555 5253"            /* , COLLABORATEURS */
	$"2045 5420 4147 454E 5453 2028 434F 4C4C"            /*  ET AGENTS (COLL */
	$"4543 5449 5645 4D45 4E54 2C20 4C45 20C7"            /* ECTIVEMENT, LE « */
	$"2047 524F 5550 4520 4D4F 5A49 4C4C 4120"            /*  GROUPE MOZILLA  */
	$"C829 204E 4520 534F 4E54 2050 4153 2052"            /* ») NE SONT PAS R */
	$"4553 504F 4E53 4142 4C45 5320 4445 5320"            /* ESPONSABLES DES  */
	$"4556 454E 5455 454C 5320 444F 4D4D 4147"            /* EVENTUELS DOMMAG */
	$"4553 2049 4E44 4952 4543 5453 2C20 5041"            /* ES INDIRECTS, PA */
	$"5254 4943 554C 4945 5253 2C20 4143 4345"            /* RTICULIERS, ACCE */
	$"5353 4F49 5245 532C 2043 4F4E 5345 4355"            /* SSOIRES, CONSECU */
	$"5449 4653 204F 5520 4558 454D 504C 4149"            /* TIFS OU EXEMPLAI */
	$"5245 5320 4445 434F 554C 414E 5420 4455"            /* RES DECOULANT DU */
	$"2050 5245 5345 4E54 2043 4F4E 5452 4154"            /*  PRESENT CONTRAT */
	$"204F 5520 53D5 5920 4154 5441 4348 414E"            /*  OU S’Y ATTACHAN */
	$"5420 4445 2051 5545 4C51 5545 204D 414E"            /* T DE QUELQUE MAN */
	$"4945 5245 2051 5545 2043 4520 534F 4954"            /* IERE QUE CE SOIT */
	$"204F 5520 4C49 4553 2041 204C D555 5449"            /*  OU LIES A L’UTI */
	$"4C49 5341 5449 4F4E 2044 5520 4C4F 4749"            /* LISATION DU LOGI */
	$"4349 454C 204F 5520 4120 4CD5 494E 4341"            /* CIEL OU A L’INCA */
	$"5041 4349 5445 2044 4520 4CD5 5554 494C"            /* PACITE DE L’UTIL */
	$"4953 4552 2C20 5920 434F 4D50 5249 5320"            /* ISER, Y COMPRIS  */
	$"4D41 4953 2053 414E 5320 53D5 5920 4C49"            /* MAIS SANS S’Y LI */
	$"4D49 5445 522C 204C 4553 2044 4F4D 4D41"            /* MITER, LES DOMMA */
	$"4745 5320 4C49 4553 2041 204C 4120 4445"            /* GES LIES A LA DE */
	$"4645 4354 494F 4E20 4445 2043 4C49 454E"            /* FECTION DE CLIEN */
	$"5453 2C20 4CD5 494E 5445 5252 5550 5449"            /* TS, L’INTERRUPTI */
	$"4F4E 2044 4520 5452 4156 4155 582C 204C"            /* ON DE TRAVAUX, L */
	$"4120 5045 5254 4520 4445 2052 4556 454E"            /* A PERTE DE REVEN */
	$"5553 2C20 4C41 2050 4552 5445 2044 4520"            /* US, LA PERTE DE  */
	$"444F 4E4E 4545 5320 4554 204C 4120 4445"            /* DONNEES ET LA DE */
	$"4641 494C 4C41 4E43 4520 4F55 204C 4520"            /* FAILLANCE OU LE  */
	$"4D41 5556 4149 5320 464F 4E43 5449 4F4E"            /* MAUVAIS FONCTION */
	$"4E45 4D45 4E54 2044 D54F 5244 494E 4154"            /* NEMENT D’ORDINAT */
	$"4555 5253 2C20 4D45 4D45 2045 4E20 4341"            /* EURS, MEME EN CA */
	$"5320 4445 204D 4953 4520 454E 2047 4152"            /* S DE MISE EN GAR */
	$"4445 2043 4F4E 5452 4520 4C41 2050 4F53"            /* DE CONTRE LA POS */
	$"5349 4249 4C49 5445 2044 4520 5445 4C53"            /* SIBILITE DE TELS */
	$"2044 4F4D 4D41 4745 5320 4554 2051 5545"            /*  DOMMAGES ET QUE */
	$"4C4C 4520 5155 4520 534F 4954 204C 4120"            /* LLE QUE SOIT LA  */
	$"5448 454F 5249 4520 2843 4F4E 5452 4154"            /* THEORIE (CONTRAT */
	$"2C20 5155 4153 492D 4445 4C49 5420 4F55"            /* , QUASI-DELIT OU */
	$"2041 5554 5245 2920 5355 5220 4C41 5155"            /*  AUTRE) SUR LAQU */
	$"454C 4C45 2053 4520 4241 5345 5241 4954"            /* ELLE SE BASERAIT */
	$"2055 4E45 2055 4E45 2045 5645 4E54 5545"            /*  UNE UNE EVENTUE */
	$"4C4C 4520 4445 4D41 4E44 452E 204C 4120"            /* LLE DEMANDE. LA  */
	$"5245 5350 4F4E 5341 4249 4C49 5445 2043"            /* RESPONSABILITE C */
	$"4F4C 4C45 4354 4956 4520 4455 2047 524F"            /* OLLECTIVE DU GRO */
	$"5550 4520 4D4F 5A49 4C4C 4120 4441 4E53"            /* UPE MOZILLA DANS */
	$"204C 4520 4341 4452 4520 4445 2043 4520"            /*  LE CADRE DE CE  */
	$"434F 4E54 5241 5420 4E45 2050 4555 5420"            /* CONTRAT NE PEUT  */
	$"4445 5041 5353 4552 2035 3030 2024 2028"            /* DEPASSER 500 $ ( */
	$"4349 4E51 2043 454E 5453 2044 4F4C 4C41"            /* CINQ CENTS DOLLA */
	$"5253 2920 4F55 204C 4553 2044 524F 4954"            /* RS) OU LES DROIT */
	$"5320 2845 5645 4E54 5545 4C4C 454D 454E"            /* S (EVENTUELLEMEN */
	$"5429 2056 4552 5345 5320 504F 5552 204C"            /* T) VERSES POUR L */
	$"4120 4C49 4345 4E43 452C 204C 4120 534F"            /* A LICENCE, LA SO */
	$"4D4D 4520 4C41 2050 4C55 5320 454C 4556"            /* MME LA PLUS ELEV */
	$"4545 2045 5441 4E54 2052 4554 454E 5545"            /* EE ETANT RETENUE */
	$"2E20 4345 5254 4149 4E45 5320 4A55 5249"            /* . CERTAINES JURI */
	$"4449 4354 494F 4E53 204E 4520 5045 524D"            /* DICTIONS NE PERM */
	$"4554 5445 4E54 2050 4153 204C D545 5843"            /* ETTENT PAS L’EXC */
	$"4C55 5349 4F4E 204F 5520 4C41 2052 4553"            /* LUSION OU LA RES */
	$"5452 4943 5449 4F4E 2044 4553 2044 4F4D"            /* TRICTION DES DOM */
	$"4D41 4745 5320 4143 4345 5353 4F49 5245"            /* MAGES ACCESSOIRE */
	$"532C 2043 4F4E 5345 4355 5449 4653 204F"            /* S, CONSECUTIFS O */
	$"5520 5041 5254 4943 554C 4945 5253 2C20"            /* U PARTICULIERS,  */
	$"4345 5454 4520 4558 434C 5553 494F 4E20"            /* CETTE EXCLUSION  */
	$"4554 2043 4554 5445 2052 4553 5452 4943"            /* ET CETTE RESTRIC */
	$"5449 4F4E 2050 4555 5645 4E54 2044 4F4E"            /* TION PEUVENT DON */
	$"4320 4E45 2050 4153 2056 4F55 5320 4554"            /* C NE PAS VOUS ET */
	$"5245 2041 5050 4C49 4341 424C 4553 2E0D"            /* RE APPLICABLES.. */
	$"0D36 2E20 434F 4E54 524F 4C45 5320 4120"            /* .6. CONTROLES A  */
	$"4CD5 4558 504F 5254 4154 494F 4E2E 204C"            /* L’EXPORTATION. L */
	$"6120 7072 8E73 656E 7465 206C 6963 656E"            /* a présente licen */
	$"6365 2065 7374 2073 6F75 6D69 7365 2088"            /* ce est soumise à */
	$"2074 6F75 7465 7320 6C65 7320 7265 7374"            /*  toutes les rest */
	$"7269 6374 696F 6E73 2061 7070 6C69 6361"            /* rictions applica */
	$"626C 6573 2088 206C D565 7870 6F72 7461"            /* bles à l’exporta */
	$"7469 6F6E 2E20 566F 7573 2064 6576 657A"            /* tion. Vous devez */
	$"2076 6F75 7320 636F 6E66 6F72 6D65 7220"            /*  vous conformer  */
	$"8820 746F 7574 6573 206C 6573 206C 6F69"            /* à toutes les loi */
	$"732C 2072 6573 7472 6963 7469 6F6E 7320"            /* s, restrictions  */
	$"6574 2072 8E67 6C65 6D65 6E74 6174 696F"            /* et réglementatio */
	$"6E73 2065 6E20 6D61 7469 8F72 6520 64D5"            /* ns en matière d’ */
	$"6578 706F 7274 6174 696F 6E20 6574 2064"            /* exportation et d */
	$"D569 6D70 6F72 7461 7469 6F6E 208E 6D61"            /* ’importation éma */
	$"6E61 6E74 2064 6520 746F 7574 206F 7267"            /* nant de tout org */
	$"616E 6973 6D65 206F 7520 6175 746F 7269"            /* anisme ou autori */
	$"748E 2064 6573 2045 7461 7473 2D55 6E69"            /* té des Etats-Uni */
	$"7320 6F75 2064 D575 6E20 7061 7973 208E"            /* s ou d’un pays é */
	$"7472 616E 6765 7220 656E 206C 6961 6973"            /* tranger en liais */
	$"6F6E 2061 7665 6320 6C65 206C 6F67 6963"            /* on avec le logic */
	$"6965 6C20 6F75 2073 6F6E 2075 7469 6C69"            /* iel ou son utili */
	$"7361 7469 6F6E 2E0D 0D37 2E20 5554 494C"            /* sation...7. UTIL */
	$"4953 4154 4555 5253 2046 494E 414C 5320"            /* ISATEURS FINALS  */
	$"4455 2047 4F55 5645 524E 454D 454E 5420"            /* DU GOUVERNEMENT  */
	$"4445 5320 4554 4154 532D 554E 4953 2E20"            /* DES ETATS-UNIS.  */
	$"4C65 206C 6F67 6963 6965 6C20 6573 7420"            /* Le logiciel est  */
	$"756E 20C7 2061 7274 6963 6C65 2063 6F6D"            /* un « article com */
	$"6D65 7263 6961 6C20 C820 2863 6F6D 6D65"            /* mercial » (comme */
	$"7263 6961 6C20 6974 656D 2920 7365 6C6F"            /* rcial item) selo */
	$"6E20 6C61 2064 8E66 696E 6974 696F 6E20"            /* n la définition  */
	$"6465 2063 6520 7465 726D 6520 6461 6E73"            /* de ce terme dans */
	$"206C 2761 7274 6963 6C65 2034 3820 432E"            /*  l'article 48 C. */
	$"462E 522E 2032 2E31 3031 2C20 636F 6E73"            /* F.R. 2.101, cons */
	$"6973 7461 6E74 2065 6E20 756E 20C7 206C"            /* istant en un « l */
	$"6F67 6963 6965 6C20 696E 666F 726D 6174"            /* ogiciel informat */
	$"6971 7565 2063 6F6D 6D65 7263 6961 6C20"            /* ique commercial  */
	$"C820 2863 6F6D 6D65 7263 6961 6C20 636F"            /* » (commercial co */
	$"6D70 7574 6572 2073 6F66 7477 6172 6529"            /* mputer software) */
	$"2065 7420 756E 6520 C720 646F 6375 6D65"            /*  et une « docume */
	$"6E74 6174 696F 6E20 6C6F 6769 6369 656C"            /* ntation logiciel */
	$"6C65 2063 6F6D 6D65 7263 6961 6C65 20C8"            /* le commerciale » */
	$"2028 636F 6D6D 6572 6369 616C 2063 6F6D"            /*  (commercial com */
	$"7075 7465 7220 736F 6674 7761 7265 2064"            /* puter software d */
	$"6F63 756D 656E 7461 7469 6F6E 2920 6175"            /* ocumentation) au */
	$"2073 656E 7320 6F9D 2063 6573 2074 6572"            /*  sens où ces ter */
	$"6D65 7320 736F 6E74 2075 7469 6C69 738E"            /* mes sont utilisé */
	$"7320 6175 7820 6172 7469 636C 6573 2034"            /* s aux articles 4 */
	$"3820 432E 462E 522E 2031 322E 3231 3220"            /* 8 C.F.R. 12.212  */
	$"2873 6570 742E 2031 3939 3529 2065 7420"            /* (sept. 1995) et  */
	$"3438 2043 2E46 2E52 2E20 3232 372E 3732"            /* 48 C.F.R. 227.72 */
	$"3032 2028 6A75 696E 2031 3939 3529 2E20"            /* 02 (juin 1995).  */
	$"436F 6E66 6F72 6D8E 6D65 6E74 2061 7578"            /* Conformément aux */
	$"2061 7274 6963 6C65 7320 3438 2043 2E46"            /*  articles 48 C.F */
	$"2E52 2E20 3132 2E32 3132 2C20 3438 2043"            /* .R. 12.212, 48 C */
	$"2E46 2E52 2E20 3237 2E34 3035 2862 2928"            /* .F.R. 27.405(b)( */
	$"3229 2028 6A75 696E 2031 3939 3829 2065"            /* 2) (juin 1998) e */
	$"7420 3438 2043 2E46 2E52 2E20 3232 372E"            /* t 48 C.F.R. 227. */
	$"3732 3032 2C20 746F 7573 206C 6573 2075"            /* 7202, tous les u */
	$"7469 6C69 7361 7465 7572 7320 6669 6E61"            /* tilisateurs fina */
	$"6C73 2064 7520 676F 7576 6572 6E65 6D65"            /* ls du gouverneme */
	$"6E74 2064 6573 2045 7461 7473 2D55 6E69"            /* nt des Etats-Uni */
	$"7320 6ED5 6F62 7469 656E 6E65 6E74 2071"            /* s n’obtiennent q */
	$"7565 206C 6573 2064 726F 6974 7320 636F"            /* ue les droits co */
	$"6E63 8E64 8E73 2064 616E 7320 6C65 2070"            /* ncédés dans le p */
	$"728E 7365 6E74 2063 6F6E 7472 6174 2065"            /* résent contrat e */
	$"6E20 6661 6973 616E 7420 6CD5 6163 7175"            /* n faisant l’acqu */
	$"6973 6974 696F 6E20 6475 206C 6F67 6963"            /* isition du logic */
	$"6965 6C2E 0D0D 382E 2044 4956 4552 532E"            /* iel...8. DIVERS. */
	$"2028 6129 204C 6520 7072 8E73 656E 7420"            /*  (a) Le présent  */
	$"636F 6E74 7261 7420 636F 6E74 7261 7420"            /* contrat contrat  */
	$"636F 6E73 7469 7475 6520 6CD5 696E 748E"            /* constitue l’inté */
	$"6772 616C 6974 8E20 6465 206C D561 6363"            /* gralité de l’acc */
	$"6F72 6420 696E 7465 7276 656E 7520 656E"            /* ord intervenu en */
	$"7472 6520 4D6F 7A69 6C6C 6120 6574 2076"            /* tre Mozilla et v */
	$"6F75 732C 2063 6F6E 6365 726E 616E 7420"            /* ous, concernant  */
	$"6CD5 6F62 6A65 7420 7175 6920 7920 6573"            /* l’objet qui y es */
	$"7420 7472 6169 748E 2C20 6574 2069 6C20"            /* t traité, et il  */
	$"6E65 2070 6575 7420 9074 7265 206D 6F64"            /* ne peut être mod */
	$"6966 698E 2071 7565 2070 6172 2061 6D65"            /* ifié que par ame */
	$"6E64 656D 656E 7420 8E63 7269 7420 7369"            /* ndement écrit si */
	$"676E 8E20 7061 7220 756E 2072 6573 706F"            /* gné par un respo */
	$"6E73 6162 6C65 2068 6162 696C 6974 8E20"            /* nsable habilité  */
	$"6465 204D 6F7A 696C 6C61 2E20 2862 2920"            /* de Mozilla. (b)  */
	$"5361 7566 2064 6973 706F 7369 7469 6F6E"            /* Sauf disposition */
	$"2063 6F6E 7472 6169 7265 208E 7665 6E74"            /*  contraire évent */
	$"7565 6C6C 6520 6475 2064 726F 6974 2061"            /* uelle du droit a */
	$"7070 6C69 6361 626C 652C 206C 6520 7072"            /* pplicable, le pr */
	$"8E73 656E 7420 636F 6E74 7261 7420 6573"            /* ésent contrat es */
	$"7420 728E 6769 2070 6172 206C 6573 206C"            /* t régi par les l */
	$"6F69 7320 6465 206C D58E 7461 7420 6465"            /* ois de l’état de */
	$"2043 616C 6966 6F72 6E69 6520 2845 7461"            /*  Californie (Eta */
	$"7473 2D55 6E69 7329 2C20 8820 6CD5 6578"            /* ts-Unis), à l’ex */
	$"636C 7573 696F 6E20 6465 2073 6573 2064"            /* clusion de ses d */
	$"6973 706F 7369 7469 6F6E 7320 7265 6C61"            /* ispositions rela */
	$"7469 7665 7320 6175 2063 6F6E 666C 6974"            /* tives au conflit */
	$"2064 6573 206C 6F69 732E 2028 6329 2043"            /*  des lois. (c) C */
	$"6520 636F 6E74 7261 7420 6ED5 6573 7420"            /* e contrat n’est  */
	$"7061 7320 728E 6769 2070 6172 206C 6120"            /* pas régi par la  */
	$"636F 6E76 656E 7469 6F6E 2064 6573 204E"            /* convention des N */
	$"6174 696F 6E73 2075 6E69 6573 2073 7572"            /* ations unies sur */
	$"206C 6573 2063 6F6E 7472 6174 7320 6465"            /*  les contrats de */
	$"2076 656E 7465 2069 6E74 6572 6E61 7469"            /*  vente internati */
	$"6F6E 616C 6520 6465 206D 6172 6368 616E"            /* onale de marchan */
	$"6469 7365 732E 2028 6429 2053 6920 7175"            /* dises. (d) Si qu */
	$"656C 7175 6520 7061 7274 6965 2071 7565"            /* elque partie que */
	$"2063 6520 736F 6974 2064 6520 6365 2063"            /*  ce soit de ce c */
	$"6F6E 7472 6174 2065 7374 2063 6F6E 7369"            /* ontrat est consi */
	$"648E 728E 6520 696E 7661 6C69 6465 206F"            /* dérée invalide o */
	$"7520 696E 6170 706C 6963 6162 6C65 2C20"            /* u inapplicable,  */
	$"6365 7474 6520 7061 7274 6965 2064 6F69"            /* cette partie doi */
	$"7420 9074 7265 2069 6E74 6572 7072 8E74"            /* t être interprét */
	$"8E65 2064 6520 736F 7274 6520 8820 7265"            /* ée de sorte à re */
	$"666C 8E74 6572 206C D569 6E74 656E 7469"            /* fléter l’intenti */
	$"6F6E 2069 6E69 7469 616C 6520 6465 7320"            /* on initiale des  */
	$"7061 7274 6965 732C 2065 7420 6C65 7320"            /* parties, et les  */
	$"706F 7274 696F 6E73 2072 6573 7461 6E74"            /* portions restant */
	$"6573 2072 6573 7465 726F 6E74 2070 6C65"            /* es resteront ple */
	$"696E 656D 656E 7420 656E 2076 6967 7565"            /* inement en vigue */
	$"7572 2E20 2865 2920 4C61 2072 656E 6F6E"            /* ur. (e) La renon */
	$"6369 6174 696F 6E20 7061 7220 6CD5 756E"            /* ciation par l’un */
	$"6520 6F75 206C D561 7574 7265 2064 6573"            /* e ou l’autre des */
	$"2070 6172 7469 6573 2088 2075 6E65 206D"            /*  parties à une m */
	$"6F64 616C 6974 8E20 6F75 2063 6F6E 6469"            /* odalité ou condi */
	$"7469 6F6E 2071 7565 6C63 6F6E 7175 6520"            /* tion quelconque  */
	$"6465 2063 6520 636F 6E74 7261 7420 6F75"            /* de ce contrat ou */
	$"2074 6F75 7465 2064 8E6E 6F6E 6369 6174"            /*  toute dénonciat */
	$"696F 6E20 6475 6469 7420 636F 6E74 7261"            /* ion dudit contra */
	$"742C 2064 616E 7320 6461 6E73 2071 7565"            /* t, dans dans que */
	$"6C71 7565 2063 6972 636F 6E73 7461 6E63"            /* lque circonstanc */
	$"6520 7175 6520 6365 2073 6F69 7420 736F"            /* e que ce soit so */
	$"6974 2C20 6E65 2063 6F6E 7374 6974 7565"            /* it, ne constitue */
	$"2070 6173 2075 6E65 2072 656E 6F6E 6369"            /*  pas une renonci */
	$"6174 696F 6E20 8820 756E 6520 7465 6C6C"            /* ation à une tell */
	$"6520 6D6F 6461 6C69 748E 206F 7520 636F"            /* e modalité ou co */
	$"6E64 6974 696F 6E2C 206E 6920 756E 6520"            /* ndition, ni une  */
	$"7175 656C 636F 6E71 7565 2072 7570 7475"            /* quelconque ruptu */
	$"7265 2075 6C74 8E72 6965 7572 6520 6475"            /* re ultérieure du */
	$"2063 6F6E 7472 6174 2E20 2866 2920 5361"            /*  contrat. (f) Sa */
	$"7566 2064 6973 706F 7369 7469 6F6E 206C"            /* uf disposition l */
	$"8E67 616C 6520 636F 6E74 7261 6972 652C"            /* égale contraire, */
	$"206C 6120 6C61 6E67 7565 2072 8E67 6973"            /*  la langue régis */
	$"7361 6E74 206C 6520 7072 8E73 656E 7420"            /* sant le présent  */
	$"636F 6E74 7261 7420 6573 7420 6CD5 616E"            /* contrat est l’an */
	$"676C 6169 732E 2028 6729 2056 6F75 7320"            /* glais. (g) Vous  */
	$"706F 7576 657A 2063 8E64 6572 206C 6573"            /* pouvez céder les */
	$"2064 726F 6974 7320 7175 6920 766F 7573"            /*  droits qui vous */
	$"2073 6F6E 7420 6F63 7472 6F79 8E73 2065"            /*  sont octroyés e */
	$"6E20 7665 7274 7520 6465 2063 6520 636F"            /* n vertu de ce co */
	$"6E74 7261 7420 8820 746F 7574 6520 7061"            /* ntrat à toute pa */
	$"7274 6965 2071 7569 2061 6363 6570 7465"            /* rtie qui accepte */
	$"2073 6573 206D 6F64 616C 6974 8E73 2065"            /*  ses modalités e */
	$"7420 636F 6E76 6965 6E74 2064 D590 7472"            /* t convient d’êtr */
	$"6520 6C69 8E65 2070 6172 2065 6C6C 6573"            /* e liée par elles */
	$"3B20 4D6F 7A69 6C6C 6120 466F 756E 6461"            /* ; Mozilla Founda */
	$"7469 6F6E 2070 6575 7420 638E 6465 7220"            /* tion peut céder  */
	$"6C65 7320 6472 6F69 7473 2071 7569 206C"            /* les droits qui l */
	$"7569 2073 6F6E 7420 6F63 7472 6F79 8E73"            /* ui sont octroyés */
	$"2065 6E20 7665 7274 7520 6475 2070 728E"            /*  en vertu du pré */
	$"7365 6E74 2063 6F6E 7472 6174 2073 616E"            /* sent contrat san */
	$"7320 636F 6E64 6974 696F 6E2E 2028 6829"            /* s condition. (h) */
	$"204C 6520 7072 8E73 656E 7420 636F 6E74"            /*  Le présent cont */
	$"7261 7420 6C69 6520 6C65 7320 7061 7274"            /* rat lie les part */
	$"6965 7320 6574 2065 6E74 7265 2065 6E20"            /* ies et entre en  */
	$"7669 6775 6575 7220 6175 2062 8E6E 8E66"            /* vigueur au bénéf */
	$"6963 6520 6465 2063 656C 6C65 732D 6369"            /* ice de celles-ci */
	$"2065 7420 6465 206C 6575 7273 2073 7563"            /*  et de leurs suc */
	$"6365 7373 6575 7273 2065 7420 6179 616E"            /* cesseurs et ayan */
	$"7473 2064 726F 6974 2061 7574 6F72 6973"            /* ts droit autoris */
	$"8E73 2E"                                            /* és. */
};

data 'styl' (5001, "French SLA") {
	$"0003 0000 0000 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 01A2 000F 000C 0400"            /* .........¢...... */
	$"0190 000C 0000 0000 0000 0000 01D6 000F"            /* .ê...........÷.. */
	$"000C 0400 0090 000C 0000 0000 0000"                 /* .....ê........ */
};

data 'TEXT' (5002, "German SLA") {
	$"4469 6573 2069 7374 2065 696E 6520 696E"            /* Dies ist eine in */
	$"6F66 6669 7A69 656C 6C65 2086 6265 7273"            /* offizielle Übers */
	$"6574 7A75 6E67 2064 6572 2043 414D 494E"            /* etzung der CAMIN */
	$"4F20 4555 4C41 2069 6E73 2044 6575 7473"            /* O EULA ins Deuts */
	$"6368 652E 2044 6965 2056 6572 7472 6167"            /* che. Die Vertrag */
	$"7362 6564 696E 6775 6E67 656E 2066 9F72"            /* sbedingungen für */
	$"2064 6965 7365 2043 414D 494E 4F20 4B6F"            /*  diese CAMINO Ko */
	$"7069 6520 7369 6E64 2064 6172 696E 206E"            /* pie sind darin n */
	$"6963 6874 2067 6573 6574 7A6C 6963 6820"            /* icht gesetzlich  */
	$"6665 7374 6765 6C65 6774 2C20 669F 7220"            /* festgelegt, für  */
	$"6569 6E65 2067 9F6C 7469 6765 2049 6E74"            /* eine gültige Int */
	$"6572 7072 6574 6174 696F 6E20 6973 7420"            /* erpretation ist  */
	$"6175 7373 6368 6C69 65A7 6C69 6368 2064"            /* ausschließlich d */
	$"6965 206E 6163 6873 7465 6865 6E64 2061"            /* ie nachstehend a */
	$"6E67 6566 9F68 7274 6520 656E 676C 6973"            /* ngeführte englis */
	$"6368 6520 4555 4C41 2D4F 7269 6769 6E61"            /* che EULA-Origina */
	$"6C76 6572 7369 6F6E 2068 6572 616E 7A75"            /* lversion heranzu */
	$"7A69 6568 656E 2E20 5769 7220 686F 6666"            /* ziehen. Wir hoff */
	$"656E 206A 6564 6F63 682C 2064 6173 7320"            /* en jedoch, dass  */
	$"6469 6573 6520 8662 6572 7365 747A 756E"            /* diese Übersetzun */
	$"6720 7A75 2065 696E 656D 2062 6573 7365"            /* g zu einem besse */
	$"7265 6E20 5665 7273 748A 6E64 6E69 7320"            /* ren Verständnis  */
	$"6465 7220 4341 4D49 4E4F 2045 554C 4120"            /* der CAMINO EULA  */
	$"669F 7220 616C 6C65 2064 6575 7473 6368"            /* für alle deutsch */
	$"2073 7072 6163 6869 6765 6E20 4E75 747A"            /*  sprachigen Nutz */
	$"6572 2062 6569 7472 6167 656E 2077 6972"            /* er beitragen wir */
	$"642E 0D0D 4341 4D49 4E4F 2045 4E44 4E55"            /* d...CAMINO ENDNU */
	$"545A 4552 2D4C 495A 454E 5A56 4552 4549"            /* TZER-LIZENZVEREI */
	$"4E42 4152 554E 470D 5665 7273 696F 6E20"            /* NBARUNG.Version  */
	$"312E 310D 0D45 494E 4520 5155 454C 4C2D"            /* 1.1..EINE QUELL- */
	$"434F 4445 2056 4552 5349 4F4E 2047 4557"            /* CODE VERSION GEW */
	$"4953 5345 5220 4341 4D49 4E4F 2042 524F"            /* ISSER CAMINO BRO */
	$"5753 4552 2046 554E 4B54 494F 4E45 4E20"            /* WSER FUNKTIONEN  */
	$"5A55 5220 4E55 545A 554E 472C 2056 4552"            /* ZUR NUTZUNG, VER */
	$"804E 4445 5255 4E47 2055 4E44 2057 4549"            /* ÄNDERUNG UND WEI */
	$"5445 5247 4142 4520 4953 5420 4B4F 5354"            /* TERGABE IST KOST */
	$"454E 4C4F 5320 4155 4620 5757 572E 4D4F"            /* ENLOS AUF WWW.MO */
	$"5A49 4C4C 412E 4F52 4720 554E 5445 5220"            /* ZILLA.ORG UNTER  */
	$"4D4F 5A49 4C4C 4120 5055 424C 4943 204C"            /* MOZILLA PUBLIC L */
	$"4943 454E 5345 2075 6E64 2061 6E64 6572"            /* ICENSE und ander */
	$"656E 204F 7065 6E2D 2053 6F75 7263 652D"            /* en Open- Source- */
	$"4C69 7A65 6E7A 656E 2045 5248 804C 544C"            /* Lizenzen ERHÄLTL */
	$"4943 482E 0D0D 4469 6520 4E75 747A 756E"            /* ICH...Die Nutzun */
	$"6720 6465 7220 6265 696C 6965 6765 6E64"            /* g der beiliegend */
	$"656E 2C20 6675 6E6B 7469 6F6E 7366 8A68"            /* en, funktionsfäh */
	$"6967 656E 2043 6F64 6576 6572 7369 6F6E"            /* igen Codeversion */
	$"2076 6F6E 2043 414D 494E 4F20 756E 6420"            /*  von CAMINO und  */
	$"6465 7220 6461 7A75 6765 689A 7269 6765"            /* der dazugehörige */
	$"6E20 446F 6B75 6D65 6E74 6174 696F 6E20"            /* n Dokumentation  */
	$"28E3 5072 6F64 756B 7422 2920 7769 7264"            /* („Produkt") wird */
	$"2049 686E 656E 207A 7520 6465 6E20 6665"            /*  Ihnen zu den fe */
	$"7374 6765 6C65 6774 656E 2042 6564 696E"            /* stgelegten Bedin */
	$"6775 6E67 656E 2069 6E20 6465 7220 6869"            /* gungen in der hi */
	$"6572 2076 6F72 6C69 6567 656E 6465 6E20"            /* er vorliegenden  */
	$"4341 4D49 4E4F 2045 4E44 4E55 545A 4552"            /* CAMINO ENDNUTZER */
	$"2D20 4C49 5A45 4E5A 5645 5245 494E 4241"            /* - LIZENZVEREINBA */
	$"5255 4E47 2028 E356 4552 4549 4E42 4152"            /* RUNG („VEREINBAR */
	$"554E 4722 2920 6765 7374 6174 7465 742E"            /* UNG") gestattet. */
	$"2044 5552 4348 2044 5286 434B 454E 2044"            /*  DURCH DRÜCKEN D */
	$"4553 2053 594D 424F 4C53 20E3 4549 4E56"            /* ES SYMBOLS „EINV */
	$"4552 5354 414E 4445 4E22 204F 4445 5220"            /* ERSTANDEN" ODER  */
	$"4455 5243 4820 494E 5354 414C 4C41 5449"            /* DURCH INSTALLATI */
	$"4F4E 204F 4445 5220 4E55 545A 554E 4720"            /* ON ODER NUTZUNG  */
	$"4445 5320 4341 4D49 4E4F 2042 524F 5753"            /* DES CAMINO BROWS */
	$"4552 5320 4552 4B45 4E4E 454E 2053 4945"            /* ERS ERKENNEN SIE */
	$"2044 4945 2049 4E20 4449 4553 4552 2056"            /*  DIE IN DIESER V */
	$"4552 4549 4E42 4152 554E 4720 4645 5354"            /* EREINBARUNG FEST */
	$"4745 4C45 4754 454E 2042 4544 494E 4755"            /* GELEGTEN BEDINGU */
	$"4E47 454E 2041 4E2E 2057 454E 4E20 5349"            /* NGEN AN. WENN SI */
	$"4520 5349 4348 204D 4954 2044 454E 2042"            /* E SICH MIT DEN B */
	$"4544 494E 4755 4E47 454E 2044 4945 5345"            /* EDINGUNGEN DIESE */
	$"5220 5645 5245 494E 4241 5255 4E47 204E"            /* R VEREINBARUNG N */
	$"4943 4854 2045 494E 5645 5253 5441 4E44"            /* ICHT EINVERSTAND */
	$"454E 2045 524B 4C80 5245 4E2C 204B 4C49"            /* EN ERKLÄREN, KLI */
	$"434B 454E 2053 4945 204E 4943 4854 2041"            /* CKEN SIE NICHT A */
	$"5546 2044 4153 2053 594D 424F 4C20 E345"            /* UF DAS SYMBOL „E */
	$"494E 5645 5253 5441 4E44 454E 2220 554E"            /* INVERSTANDEN" UN */
	$"4420 494E 5354 414C 4C49 4552 454E 204F"            /* D INSTALLIEREN O */
	$"4445 5220 4E55 545A 454E 2053 4945 2057"            /* DER NUTZEN SIE W */
	$"4544 4552 2044 454E 2043 414D 494E 4F20"            /* EDER DEN CAMINO  */
	$"4252 4F57 5345 5220 4E4F 4348 2054 4549"            /* BROWSER NOCH TEI */
	$"4C45 2044 4156 4F4E 2E0D 0D57 8048 5245"            /* LE DAVON...WÄHRE */
	$"4E44 2055 4E44 204E 4143 4820 4445 5220"            /* ND UND NACH DER  */
	$"494E 5354 414C 4C41 5449 4F4E 2056 4F4E"            /* INSTALLATION VON */
	$"2043 414D 494E 4F20 5749 5244 2045 5320"            /*  CAMINO WIRD ES  */
	$"4948 4E45 4E20 5649 454C 4C45 4943 4854"            /* IHNEN VIELLEICHT */
	$"2045 524D 8547 4C49 4348 542C 205A 5553"            /*  ERMÖGLICHT, ZUS */
	$"8054 5A4C 4943 4845 2053 4F46 5457 4152"            /* ÄTZLICHE SOFTWAR */
	$"454B 4F4D 504F 4E45 4E54 454E 2056 4F4E"            /* EKOMPONENTEN VON */
	$"2044 5249 5454 414E 4249 4554 4552 4E20"            /*  DRITTANBIETERN  */
	$"5A55 2049 4E53 5441 4C4C 4945 5245 4E2E"            /* ZU INSTALLIEREN. */
	$"2044 4945 2049 4E53 5441 4C4C 4945 5255"            /*  DIE INSTALLIERU */
	$"4E47 2055 4E44 204E 5554 5A55 4E47 2053"            /* NG UND NUTZUNG S */
	$"4F4C 4348 4552 2044 5249 5454 414E 4249"            /* OLCHER DRITTANBI */
	$"4554 4552 204B 4F4D 504F 4E45 4E54 454E"            /* ETER KOMPONENTEN */
	$"2057 4952 4420 4455 5243 4820 4745 534F"            /*  WIRD DURCH GESO */
	$"4E44 4552 5445 204C 495A 454E 5A56 4552"            /* NDERTE LIZENZVER */
	$"4549 4E42 4152 554E 4745 4E20 4745 5245"            /* EINBARUNGEN GERE */
	$"4745 4C54 2E0D 0D31 2E20 4C49 5A45 4E5A"            /* GELT...1. LIZENZ */
	$"4745 5780 4852 554E 472E 204D 6F7A 696C"            /* GEWÄHRUNG. Mozil */
	$"6C61 2067 6577 8A68 7274 2049 686E 656E"            /* la gewährt Ihnen */
	$"206D 6974 2064 6965 7365 7220 4C69 7A65"            /*  mit dieser Lize */
	$"6E7A 2065 696E 206E 6963 6874 2D61 7573"            /* nz ein nicht-aus */
	$"7363 686C 6965 A76C 6963 6865 7320 5265"            /* schließliches Re */
	$"6368 7420 7A75 7220 4E75 747A 756E 6720"            /* cht zur Nutzung  */
	$"6469 6573 6572 2066 756E 6B74 696F 6E73"            /* dieser funktions */
	$"668A 6869 6765 6E20 436F 6465 7665 7273"            /* fähigen Codevers */
	$"696F 6E20 6465 7320 5072 6F64 756B 7473"            /* ion des Produkts */
	$"2E20 4469 6573 6520 4C69 7A65 6E7A 7665"            /* . Diese Lizenzve */
	$"7265 696E 6261 7275 6E67 2072 6567 656C"            /* reinbarung regel */
	$"7420 6175 A765 7264 656D 2073 8A6D 746C"            /* t außerdem sämtl */
	$"6963 6865 2076 6F6E 204D 6F7A 696C 6C61"            /* iche von Mozilla */
	$"2068 6572 6175 7367 6567 6562 656E 656E"            /*  herausgegebenen */
	$"2053 6F66 7477 6172 6520 5570 6772 6164"            /*  Software Upgrad */
	$"6573 2C20 7765 6C63 6865 2064 6965 204F"            /* es, welche die O */
	$"7269 6769 6E61 6C76 6572 7369 6F6E 2065"            /* riginalversion e */
	$"7273 6574 7A65 6E20 756E 642F 6F64 6572"            /* rsetzen und/oder */
	$"2065 7267 8A6E 7A65 6E2C 2073 6F66 6572"            /*  ergänzen, sofer */
	$"6E20 736F 6C63 6865 2055 7067 7261 6465"            /* n solche Upgrade */
	$"7320 6E69 6368 7420 6475 7263 6820 6765"            /* s nicht durch ge */
	$"736F 6E64 6572 7465 204C 697A 656E 7A65"            /* sonderte Lizenze */
	$"6E20 6D69 7420 6569 6765 6E73 2064 6566"            /* n mit eigens def */
	$"696E 6965 7274 656E 2042 6564 696E 6775"            /* inierten Bedingu */
	$"6E67 656E 2067 6572 6567 656C 7420 7765"            /* ngen geregelt we */
	$"7264 656E 2E0D 0D32 2E20 4245 454E 4449"            /* rden...2. BEENDI */
	$"4755 4E47 2E20 4265 6920 5665 7273 746F"            /* GUNG. Bei Versto */
	$"A720 6765 6765 6E20 6469 6573 6520 4C69"            /* ß gegen diese Li */
	$"7A65 6E7A 7665 7265 696E 6261 7275 6E67"            /* zenzvereinbarung */
	$"2065 6E64 656E 2064 6965 204E 7574 7A75"            /*  enden die Nutzu */
	$"6E67 7372 6563 6874 6520 616D 2050 726F"            /* ngsrechte am Pro */
	$"6475 6B74 2075 6E76 6572 7A9F 676C 6963"            /* dukt unverzüglic */
	$"6820 756E 6420 6F68 6E65 2042 656E 6163"            /* h und ohne Benac */
	$"6872 6963 6874 6967 756E 672E 2053 8A6D"            /* hrichtigung. Säm */
	$"746C 6963 6865 2069 6E20 6469 6573 6572"            /* tliche in dieser */
	$"2056 6572 6569 6E62 6172 756E 6720 656E"            /*  Vereinbarung en */
	$"7468 616C 7465 6E65 6E20 4265 7374 696D"            /* thaltenen Bestim */
	$"6D75 6E67 656E 2C20 6175 7367 656E 6F6D"            /* mungen, ausgenom */
	$"6D65 6E20 6469 6520 4C69 7A65 6E7A 6765"            /* men die Lizenzge */
	$"778A 6872 756E 6720 2841 6273 6174 7A20"            /* währung (Absatz  */
	$"3129 2C20 626C 6569 6265 6E20 6E61 6368"            /* 1), bleiben nach */
	$"2045 6E64 6520 6465 7220 5665 7265 696E"            /*  Ende der Verein */
	$"6261 7275 6E67 206A 6564 6F63 6820 7765"            /* barung jedoch we */
	$"6974 6572 2062 6573 7465 6865 6E2E 2042"            /* iter bestehen. B */
	$"6569 2042 6565 6E64 6967 756E 6720 6D9F"            /* ei Beendigung mü */
	$"7373 656E 2073 8A6D 746C 6963 6865 204B"            /* ssen sämtliche K */
	$"6F70 6965 6E20 6465 7320 5072 6F64 756B"            /* opien des Produk */
	$"7473 2076 6572 6E69 6368 7465 7420 7765"            /* ts vernichtet we */
	$"7264 656E 2E0D 0D33 2E20 4549 4745 4E54"            /* rden...3. EIGENT */
	$"554D 5352 4543 4854 452E 2054 6569 6C65"            /* UMSRECHTE. Teile */
	$"2064 6573 2050 726F 6475 6B74 7320 7369"            /*  des Produkts si */
	$"6E64 2069 6E20 5175 656C 6C63 6F64 652D"            /* nd in Quellcode- */
	$"466F 726D 207A 7520 6465 6E20 696E 2064"            /* Form zu den in d */
	$"6572 204D 6F7A 696C 6C61 2050 7562 6C69"            /* er Mozilla Publi */
	$"6320 4C69 6365 6E73 6520 756E 6420 696E"            /* c License und in */
	$"2061 6E64 6572 656E 204F 7065 6E2D 536F"            /*  anderen Open-So */
	$"7572 6365 2D4C 697A 656E 7A65 6E20 287A"            /* urce-Lizenzen (z */
	$"7573 616D 6D65 6E67 6566 6173 7374 20E3"            /* usammengefasst „ */
	$"4F70 656E 2D53 6F75 7263 652D 4C69 7A65"            /* Open-Source-Lize */
	$"6E7A 656E 2229 2066 6573 7467 6568 616C"            /* nzen") festgehal */
	$"7465 6E65 6E20 4265 7374 696D 6D75 6E67"            /* tenen Bestimmung */
	$"656E 2061 7566 2068 7474 703A 2F2F 7777"            /* en auf http://ww */
	$"772E 6D6F 7A69 6C6C 612E 6F72 6720 6572"            /* w.mozilla.org er */
	$"688A 6C74 6C69 6368 2E20 4469 6573 6520"            /* hältlich. Diese  */
	$"5665 7265 696E 6261 7275 6E67 2065 6E74"            /* Vereinbarung ent */
	$"688A 6C74 206B 6569 6E65 726C 6569 2042"            /* hält keinerlei B */
	$"6564 696E 6775 6E67 656E 2C20 6469 6520"            /* edingungen, die  */
	$"6972 6765 6E64 7765 6C63 6865 2C20 696E"            /* irgendwelche, in */
	$"2064 656E 204F 7065 6E2D 536F 7572 6365"            /*  den Open-Source */
	$"2D4C 697A 656E 7A65 6E20 6765 778A 6872"            /* -Lizenzen gewähr */
	$"7465 2052 6563 6874 6520 6569 6E73 6368"            /* te Rechte einsch */
	$"728A 6E6B 656E 2E20 566F 7262 6568 616C"            /* ränken. Vorbehal */
	$"746C 6963 6820 6465 7220 766F 7268 6572"            /* tlich der vorher */
	$"6765 6865 6E64 656E 2042 6573 7469 6D6D"            /* gehenden Bestimm */
	$"756E 6765 6E20 6265 688A 6C74 2073 6963"            /* ungen behält sic */
	$"6820 4D6F 7A69 6C6C 6120 669F 7220 7369"            /* h Mozilla für si */
	$"6368 2075 6E64 2069 6D20 4E61 6D65 6E20"            /* ch und im Namen  */
	$"7365 696E 6572 204C 697A 656E 7A6E 6568"            /* seiner Lizenzneh */
	$"6D65 7220 738A 6D74 6C69 6368 6520 6765"            /* mer sämtliche ge */
	$"6973 7469 6765 6E20 4569 6765 6E74 756D"            /* istigen Eigentum */
	$"7372 6563 6874 6520 616D 2050 726F 6475"            /* srechte am Produ */
	$"6B74 2C20 6175 7367 656E 6F6D 6D65 6E20"            /* kt, ausgenommen  */
	$"6A65 6E65 7220 5265 6368 7465 2C20 6469"            /* jener Rechte, di */
	$"6520 696E 2064 6965 7365 7220 5665 7265"            /* e in dieser Vere */
	$"696E 6261 7275 6E67 2061 7573 6472 9F63"            /* inbarung ausdrüc */
	$"6B6C 6963 6820 6765 778A 6872 7420 7765"            /* klich gewährt we */
	$"7264 656E 2C20 766F 722E 2053 6965 2064"            /* rden, vor. Sie d */
	$"9F72 6665 6E20 4D61 726B 656E 7A65 6963"            /* ürfen Markenzeic */
	$"6865 6E2C 204C 6F67 6F73 2C20 4869 6E77"            /* hen, Logos, Hinw */
	$"6569 7365 2061 7566 2055 7268 6562 6572"            /* eise auf Urheber */
	$"7265 6368 7465 206F 6465 7220 616E 6465"            /* rechte oder ande */
	$"7265 2045 6967 656E 7475 6D73 7265 6368"            /* re Eigentumsrech */
	$"7465 2069 6E20 6F64 6572 2061 6D20 5072"            /* te in oder am Pr */
	$"6F64 756B 7420 7765 6465 7220 656E 7466"            /* odukt weder entf */
	$"6572 6E65 6E20 6E6F 6368 2076 6572 8A6E"            /* ernen noch verän */
	$"6465 726E 2E20 4469 6573 6520 4C69 7A65"            /* dern. Diese Lize */
	$"6E7A 2067 6577 8A68 7274 2049 686E 656E"            /* nz gewährt Ihnen */
	$"206B 6569 6E20 5265 6368 742C 204D 6172"            /*  kein Recht, Mar */
	$"6B65 6E7A 6569 6368 656E 2C20 4469 656E"            /* kenzeichen, Dien */
	$"7374 6C65 6973 7475 6E67 736D 6172 6B65"            /* stleistungsmarke */
	$"6E20 6F64 6572 204C 6F67 6F73 2076 6F6E"            /* n oder Logos von */
	$"204D 6F7A 696C 6C61 206F 6465 7220 7365"            /*  Mozilla oder se */
	$"696E 656E 204C 697A 656E 7A6E 6568 6D65"            /* inen Lizenznehme */
	$"726E 207A 7520 7665 7277 656E 6465 6E2E"            /* rn zu verwenden. */
	$"0D0D 342E 2047 4557 8048 524C 4549 5354"            /* ..4. GEWÄHRLEIST */
	$"554E 4753 4155 5353 4348 4C55 5353 2E20"            /* UNGSAUSSCHLUSS.  */
	$"4441 5320 5052 4F44 554B 5420 5749 5244"            /* DAS PRODUKT WIRD */
	$"2049 484E 454E 20E3 5749 4520 4245 5345"            /*  IHNEN „WIE BESE */
	$"4845 4E22 2045 494E 5343 484C 4945 5353"            /* HEN" EINSCHLIESS */
	$"4C49 4348 2045 5645 4E54 5545 4C4C 2056"            /* LICH EVENTUELL V */
	$"4F52 4841 4E44 454E 4552 2046 4548 4C45"            /* ORHANDENER FEHLE */
	$"5220 5A55 5220 5645 5246 8647 554E 4720"            /* R ZUR VERFÜGUNG  */
	$"4745 5354 454C 4C54 2E20 534F 5745 4954"            /* GESTELLT. SOWEIT */
	$"2045 5320 4441 5320 4745 5345 545A 205A"            /*  ES DAS GESETZ Z */
	$"554C 8053 5354 2C20 5343 484C 4945 5353"            /* ULÄSST, SCHLIESS */
	$"454E 204D 4F5A 494C 4C41 2C20 4445 5353"            /* EN MOZILLA, DESS */
	$"454E 2056 4552 5452 4945 4253 5041 5254"            /* EN VERTRIEBSPART */
	$"4E45 5220 554E 4420 4C49 5A45 4E5A 4E45"            /* NER UND LIZENZNE */
	$"484D 4552 204A 4547 4C49 4348 4520 4745"            /* HMER JEGLICHE GE */
	$"5780 4852 4C45 4953 5455 4E47 2C20 534F"            /* WÄHRLEISTUNG, SO */
	$"574F 484C 2041 5553 4452 8643 4B4C 4943"            /* WOHL AUSDRÜCKLIC */
	$"4845 5220 414C 5320 4155 4348 2053 5449"            /* HER ALS AUCH STI */
	$"4C4C 5343 4857 4549 4745 4E44 4552 204E"            /* LLSCHWEIGENDER N */
	$"4154 5552 2041 5553 2C20 4549 4E53 4348"            /* ATUR AUS, EINSCH */
	$"4C49 4553 534C 4943 4820 4A45 474C 4943"            /* LIESSLICH JEGLIC */
	$"4845 5220 4741 5241 4E54 4945 2046 8652"            /* HER GARANTIE FÜR */
	$"2046 4548 4C45 5246 5245 4948 4549 542C"            /*  FEHLERFREIHEIT, */
	$"2056 4552 4B80 5546 4C49 4348 4B45 4954"            /*  VERKÄUFLICHKEIT */
	$"2C20 5441 5547 4C49 4348 4B45 4954 2046"            /* , TAUGLICHKEIT F */
	$"8652 2045 494E 454E 2042 4553 5449 4D4D"            /* ÜR EINEN BESTIMM */
	$"5445 4E20 5A57 4543 4B20 554E 4420 4E49"            /* TEN ZWECK UND NI */
	$"4348 5456 4552 4C45 545A 554E 4720 564F"            /* CHTVERLETZUNG VO */
	$"4E20 4549 4745 4E54 554D 5352 4543 4854"            /* N EIGENTUMSRECHT */
	$"454E 2C20 574F 4245 4920 4449 4553 4520"            /* EN, WOBEI DIESE  */
	$"4155 465A 8048 4C55 4E47 204E 4943 4854"            /* AUFZÄHLUNG NICHT */
	$"2041 4253 4348 4C49 4553 5345 4E44 2049"            /*  ABSCHLIESSEND I */
	$"5354 2E20 4441 5320 4745 5341 4D54 4520"            /* ST. DAS GESAMTE  */
	$"5249 5349 4B4F 2048 494E 5349 4348 544C"            /* RISIKO HINSICHTL */
	$"4943 4820 4549 474E 554E 472C 2051 5541"            /* ICH EIGNUNG, QUA */
	$"4C49 5480 5420 554E 4420 4C45 4953 5455"            /* LITÄT UND LEISTU */
	$"4E47 2044 4553 2050 524F 4455 4B54 5320"            /* NG DES PRODUKTS  */
	$"4C49 4547 5420 4245 4920 4948 4E45 4E2E"            /* LIEGT BEI IHNEN. */
	$"2044 4945 5345 5220 4745 5780 4852 4C45"            /*  DIESER GEWÄHRLE */
	$"4953 5455 4E47 5341 5553 5343 484C 5553"            /* ISTUNGSAUSSCHLUS */
	$"5320 4749 4C54 2055 4E47 4541 4348 5445"            /* S GILT UNGEACHTE */
	$"5420 4D85 474C 4943 4845 5220 5645 5246"            /* T MÖGLICHER VERF */
	$"4548 4C55 4E47 2045 494E 4553 2041 4E47"            /* EHLUNG EINES ANG */
	$"4553 5452 4542 5445 4E20 5A57 4543 4B53"            /* ESTREBTEN ZWECKS */
	$"2E20 494E 2045 494E 4947 454E 204C 804E"            /* . IN EINIGEN LÄN */
	$"4445 524E 2049 5354 2044 4945 2042 4553"            /* DERN IST DIE BES */
	$"4348 5280 4E4B 554E 4720 425A 572E 2044"            /* CHRÄNKUNG BZW. D */
	$"4552 2048 4146 5455 4E47 5341 5553 5343"            /* ER HAFTUNGSAUSSC */
	$"484C 5553 5320 4E49 4348 5420 5A55 4C80"            /* HLUSS NICHT ZULÄ */
	$"5353 4947 2C20 534F 4441 5353 2044 4945"            /* SSIG, SODASS DIE */
	$"5345 2045 494E 5343 4852 804E 4B55 4E47"            /* SE EINSCHRÄNKUNG */
	$"204D 8547 4C49 4348 4552 5745 4953 4520"            /*  MÖGLICHERWEISE  */
	$"4686 5220 5349 4520 4E49 4348 5420 5A55"            /* FÜR SIE NICHT ZU */
	$"5452 4946 4654 2E0D 0D35 2E20 4841 4654"            /* TRIFFT...5. HAFT */
	$"554E 4753 4245 5343 4852 804E 4B55 4E47"            /* UNGSBESCHRÄNKUNG */
	$"2E20 564F 5242 4548 414C 544C 4943 4820"            /* . VORBEHALTLICH  */
	$"4445 5220 4745 5345 545A 4745 4255 4E47"            /* DER GESETZGEBUNG */
	$"2048 4146 5445 4E20 5745 4445 5220 4D4F"            /*  HAFTEN WEDER MO */
	$"5A49 4C4C 4120 4E4F 4348 2044 4553 5345"            /* ZILLA NOCH DESSE */
	$"4E20 5A55 4C49 4546 4552 4552 2C20 4745"            /* N ZULIEFERER, GE */
	$"5343 4880 4654 5346 8648 5245 522C 204C"            /* SCHÄFTSFÜHRER, L */
	$"495A 454E 5A4E 4548 4D45 522C 204D 4954"            /* IZENZNEHMER, MIT */
	$"4152 4245 4954 4552 2055 4E44 2042 4556"            /* ARBEITER UND BEV */
	$"4F4C 4C4D 8043 4854 4947 5445 2028 5A55"            /* OLLMÄCHTIGTE (ZU */
	$"5341 4D4D 454E 4745 4641 5353 5420 4449"            /* SAMMENGEFASST DI */
	$"4520 E34D 4F5A 494C 4C41 2047 5255 5050"            /* E „MOZILLA GRUPP */
	$"4522 2920 4686 5220 4D49 5454 454C 4241"            /* E") FÜR MITTELBA */
	$"5245 2C20 4B4F 4E4B 5245 5445 2C20 5A55"            /* RE, KONKRETE, ZU */
	$"4680 4C4C 4947 2045 4E54 5354 414E 4445"            /* FÄLLIG ENTSTANDE */
	$"4E45 2053 4348 8044 454E 2055 4E44 2046"            /* NE SCHÄDEN UND F */
	$"4F4C 4745 5343 4880 4445 4E2C 2044 4945"            /* OLGESCHÄDEN, DIE */
	$"2053 4943 4820 4155 5320 4F44 4552 2049"            /*  SICH AUS ODER I */
	$"4E20 5A55 5341 4D4D 454E 4841 4E47 204D"            /* N ZUSAMMENHANG M */
	$"4954 2044 4945 5345 5220 5645 5245 494E"            /* IT DIESER VEREIN */
	$"4241 5255 4E47 204F 4445 5220 4155 5320"            /* BARUNG ODER AUS  */
	$"4445 5220 4E55 545A 554E 4720 564F 4E20"            /* DER NUTZUNG VON  */
	$"425A 572E 2055 4E4D 8547 4C49 4348 4B45"            /* BZW. UNMÖGLICHKE */
	$"4954 2044 4552 204E 5554 5A55 4E47 2044"            /* IT DER NUTZUNG D */
	$"4945 5345 5320 5052 4F44 554B 5453 2045"            /* IESES PRODUKTS E */
	$"5247 4542 454E 2C20 4549 4E53 4348 4C49"            /* RGEBEN, EINSCHLI */
	$"4553 534C 4943 482C 2047 4553 4348 8046"            /* ESSLICH, GESCHÄF */
	$"5453 5645 524C 5553 542C 2047 4553 4348"            /* TSVERLUST, GESCH */
	$"8046 5453 554E 5445 5242 5245 4348 554E"            /* ÄFTSUNTERBRECHUN */
	$"472C 2045 4E54 4741 4E47 454E 4520 4745"            /* G, ENTGANGENE GE */
	$"5749 4E4E 452C 2044 4154 454E 5645 524C"            /* WINNE, DATENVERL */
	$"5553 5420 554E 4420 434F 4D50 5554 4552"            /* UST UND COMPUTER */
	$"4645 484C 4552 204F 4445 5220 2D53 5485"            /* FEHLER ODER -STÖ */
	$"5255 4E47 454E 2C20 574F 4245 4920 4449"            /* RUNGEN, WOBEI DI */
	$"4553 4520 4155 465A 8048 4C55 4E47 204E"            /* ESE AUFZÄHLUNG N */
	$"4943 4854 2041 4253 4348 4C49 4553 5345"            /* ICHT ABSCHLIESSE */
	$"4E44 2049 5354 2C20 5345 4C42 5354 2057"            /* ND IST, SELBST W */
	$"454E 4E20 4155 4620 4449 4520 4D85 474C"            /* ENN AUF DIE MÖGL */
	$"4943 484B 4549 5420 534F 4C43 4845 5220"            /* ICHKEIT SOLCHER  */
	$"5343 4880 4445 4E20 4155 464D 4552 4B53"            /* SCHÄDEN AUFMERKS */
	$"414D 2047 454D 4143 4854 2057 5552 4445"            /* AM GEMACHT WURDE */
	$"2055 4E44 2055 4E47 4541 4348 5445 5420"            /*  UND UNGEACHTET  */
	$"4445 5220 4752 554E 444C 4147 4520 2856"            /* DER GRUNDLAGE (V */
	$"4552 5452 4147 2C20 554E 4552 4C41 5542"            /* ERTRAG, UNERLAUB */
	$"5445 2048 414E 444C 554E 4720 4F44 4552"            /* TE HANDLUNG ODER */
	$"2053 4F4E 5354 4947 4553 292C 2041 5546"            /*  SONSTIGES), AUF */
	$"2044 4552 2053 4F4C 4348 4520 4745 5780"            /*  DER SOLCHE GEWÄ */
	$"4852 4C45 4953 5455 4E47 5341 4E53 5052"            /* HRLEISTUNGSANSPR */
	$"8643 4845 2042 4153 4945 5245 4E2E 2044"            /* ÜCHE BASIEREN. D */
	$"4945 2053 4943 4820 4155 4620 4449 4553"            /* IE SICH AUF DIES */
	$"4520 5645 5245 494E 4241 5255 4E47 2047"            /* E VEREINBARUNG G */
	$"5286 4E44 454E 4445 2047 454D 4549 4E53"            /* RÜNDENDE GEMEINS */
	$"414D 4520 4841 4654 554E 4720 4445 5220"            /* AME HAFTUNG DER  */
	$"4D4F 5A49 4C4C 4120 4752 5550 5045 2042"            /* MOZILLA GRUPPE B */
	$"4553 4348 5280 4E4B 5420 5349 4348 2049"            /* ESCHRÄNKT SICH I */
	$"484E 454E 2047 4547 454E 8642 4552 2041"            /* HNEN GEGENÜBER A */
	$"5546 2045 494E 454E 2042 4554 5241 4720"            /* UF EINEN BETRAG  */
	$"564F 4E20 4249 5320 5A55 2035 3030 2028"            /* VON BIS ZU 500 ( */
	$"4686 4E46 4855 4E44 4552 5429 2055 532D"            /* FÜNFHUNDERT) US- */
	$"444F 4C4C 4152 2042 5A57 2E20 4155 4620"            /* DOLLAR BZW. AUF  */
	$"4445 4E20 4245 5452 4147 2C20 4445 4E20"            /* DEN BETRAG, DEN  */
	$"5349 4520 284D 8547 4C49 4348 4552 5745"            /* SIE (MÖGLICHERWE */
	$"4953 4529 2041 4C53 204B 8055 4645 5220"            /* ISE) ALS KÄUFER  */
	$"4686 5220 4449 4520 4C49 5A45 4E5A 4945"            /* FÜR DIE LIZENZIE */
	$"5254 4520 534F 4654 5741 5245 2042 455A"            /* RTE SOFTWARE BEZ */
	$"4148 4C54 2048 4142 454E 2E20 494E 2045"            /* AHLT HABEN. IN E */
	$"494E 4947 454E 204C 804E 4445 524E 2049"            /* INIGEN LÄNDERN I */
	$"5354 2044 4945 2042 4553 4348 5280 4E4B"            /* ST DIE BESCHRÄNK */
	$"554E 4720 425A 572E 2044 4552 2048 4146"            /* UNG BZW. DER HAF */
	$"5455 4E47 5341 5553 5343 484C 5553 5320"            /* TUNGSAUSSCHLUSS  */
	$"564F 4E20 4D49 5454 454C 4241 5245 4E2C"            /* VON MITTELBAREN, */
	$"204B 4F4E 4B52 4554 454E 204F 4445 5220"            /*  KONKRETEN ODER  */
	$"464F 4C47 4553 4348 8044 454E 204E 4943"            /* FOLGESCHÄDEN NIC */
	$"4854 205A 554C 8053 5349 472C 2053 4F44"            /* HT ZULÄSSIG, SOD */
	$"4153 5320 4449 4553 4520 4549 4E53 4348"            /* ASS DIESE EINSCH */
	$"5280 4E4B 554E 4720 4D85 474C 4943 4845"            /* RÄNKUNG MÖGLICHE */
	$"5257 4549 5345 2046 8652 2053 4945 204E"            /* RWEISE FÜR SIE N */
	$"4943 4854 205A 5554 5249 4646 542E 0D0D"            /* ICHT ZUTRIFFT... */
	$"362E 2045 5850 4F52 544B 4F4E 5452 4F4C"            /* 6. EXPORTKONTROL */
	$"4C45 4E2E 2044 6965 7365 204C 697A 656E"            /* LEN. Diese Lizen */
	$"7A20 756E 7465 726C 6965 6774 2073 8A6D"            /* z unterliegt säm */
	$"746C 6963 6865 6E20 679F 6C74 6967 656E"            /* tlichen gültigen */
	$"2045 7870 6F72 7462 6573 6368 728A 6E6B"            /*  Exportbeschränk */
	$"756E 6765 6E2E 2053 6965 206D 9F73 7365"            /* ungen. Sie müsse */
	$"6E20 696E 2042 657A 7567 2061 7566 2064"            /* n in Bezug auf d */
	$"6173 2050 726F 6475 6B74 2075 6E64 2064"            /* as Produkt und d */
	$"6573 7365 6E20 5665 7277 656E 6475 6E67"            /* essen Verwendung */
	$"2073 8A6D 746C 6963 6865 6E20 4569 6E2D"            /*  sämtlichen Ein- */
	$"2075 6E64 2041 7573 6675 6872 6265 7374"            /*  und Ausfuhrbest */
	$"696D 6D75 6E67 656E 2075 6E64 2042 6573"            /* immungen und Bes */
	$"7469 6D6D 756E 6765 6E20 756E 6420 4765"            /* timmungen und Ge */
	$"7365 747A 656E 2061 6C6C 6572 2055 532D"            /* setzen aller US- */
	$"4275 6E64 6573 7374 6161 7465 6E20 6F64"            /* Bundesstaaten od */
	$"6572 2061 7573 6C8A 6E64 6973 6368 656E"            /* er ausländischen */
	$"2042 6568 9A72 6465 6E20 5265 6368 6E75"            /*  Behörden Rechnu */
	$"6E67 2074 7261 6765 6E2E 0D0D 372E 2045"            /* ng tragen...7. E */
	$"4E44 4E55 545A 4552 2044 4552 2055 532D"            /* NDNUTZER DER US- */
	$"4255 4E44 4553 5245 4749 4552 554E 472E"            /* BUNDESREGIERUNG. */
	$"2042 6569 2064 656D 2050 726F 6475 6B74"            /*  Bei dem Produkt */
	$"2068 616E 6465 6C74 2065 7320 7369 6368"            /*  handelt es sich */
	$"206C 6175 7420 4265 6772 6966 6673 6465"            /*  laut Begriffsde */
	$"6669 6E69 7469 6F6E 2075 6E74 6572 2034"            /* finition unter 4 */
	$"3820 432E 462E 522E 2028 5665 729A 6666"            /* 8 C.F.R. (Veröff */
	$"656E 746C 6963 6875 6E67 2076 6F6E 2042"            /* entlichung von B */
	$"756E 6465 7376 6572 6F72 646E 756E 6765"            /* undesverordnunge */
	$"6E20 756E 6420 5665 7277 616C 7475 6E67"            /* n und Verwaltung */
	$"7376 6F72 7363 6872 6966 7465 6E29 2032"            /* svorschriften) 2 */
	$"2E31 3031 2075 6D20 2263 6F6D 6D65 7263"            /* .101 um "commerc */
	$"6961 6C20 6974 656D 7322 2028 6765 7765"            /* ial items" (gewe */
	$"7262 6C69 6368 6520 479F 7465 7229 2C20"            /* rbliche Güter),  */
	$"6469 6520 7369 6368 206C 6175 7420 4465"            /* die sich laut De */
	$"6669 6E69 7469 6F6E 2075 6E74 6572 2034"            /* finition unter 4 */
	$"3820 432E 462E 522E 2031 322E 3231 3220"            /* 8 C.F.R. 12.212  */
	$"2853 6570 742E 2031 3939 3529 2062 7A77"            /* (Sept. 1995) bzw */
	$"2E20 3438 2043 2E46 2E52 2E20 3232 372E"            /* . 48 C.F.R. 227. */
	$"3732 3032 2028 4A75 6E69 2031 3939 3529"            /* 7202 (Juni 1995) */
	$"2061 7573 20D2 636F 6D6D 6572 6369 616C"            /*  aus “commercial */
	$"2063 6F6D 7075 7465 7220 736F 6674 7761"            /*  computer softwa */
	$"7265 D220 2867 6577 6572 626C 6963 6865"            /* re“ (gewerbliche */
	$"2043 6F6D 7075 7465 7273 6F66 7477 6172"            /*  Computersoftwar */
	$"6529 2075 6E64 2022 636F 6D6D 6572 6369"            /* e) und "commerci */
	$"616C 2063 6F6D 7075 7465 7220 736F 6674"            /* al computer soft */
	$"7761 7265 2064 6F63 756D 656E 7461 7469"            /* ware documentati */
	$"6F6E D220 2844 6F6B 756D 656E 7461 7469"            /* on“ (Dokumentati */
	$"6F6E 2066 9F72 2067 6577 6572 626C 6963"            /* on für gewerblic */
	$"6865 2043 6F6D 7075 7465 7273 6F66 7477"            /* he Computersoftw */
	$"6172 6529 207A 7573 616D 6D65 6E73 6574"            /* are) zusammenset */
	$"7A65 6E2E 2044 6173 2050 726F 6475 6B74"            /* zen. Das Produkt */
	$"2077 6972 6420 616E 2045 6E64 6E75 747A"            /*  wird an Endnutz */
	$"6572 2064 6572 2055 532D 5265 6769 6572"            /* er der US-Regier */
	$"756E 6720 6175 7373 6368 6C69 65A7 6C69"            /* ung ausschließli */
	$"6368 2069 6E20 8662 6572 6569 6E73 7469"            /* ch in Übereinsti */
	$"6D6D 756E 6720 6D69 7420 6465 6E20 696E"            /* mmung mit den in */
	$"2034 3820 432E 462E 522E 2031 322E 3231"            /*  48 C.F.R. 12.21 */
	$"322C 2034 3820 432E 462E 522E 2032 372E"            /* 2, 48 C.F.R. 27. */
	$"3430 3528 6229 2028 3229 2028 4A75 6E69"            /* 405(b) (2) (Juni */
	$"2031 3939 3829 2075 6E64 2034 3820 432E"            /*  1998) und 48 C. */
	$"462E 522E 2032 3237 2E37 3230 3220 6665"            /* F.R. 227.7202 fe */
	$"7374 6765 6C65 6774 656E 2052 6563 6874"            /* stgelegten Recht */
	$"656E 206C 697A 656E 7A69 6572 742E 0D0D"            /* en lizenziert... */
	$"382E 2053 4F4E 5354 4947 4553 2E20 2861"            /* 8. SONSTIGES. (a */
	$"2920 4469 6573 6572 204C 697A 656E 7A76"            /* ) Dieser Lizenzv */
	$"6572 7472 6167 2065 6E74 688A 6C74 2073"            /* ertrag enthält s */
	$"8A6D 746C 6963 6865 2056 6572 6569 6E62"            /* ämtliche Vereinb */
	$"6172 756E 6765 6E20 7A77 6973 6368 656E"            /* arungen zwischen */
	$"204D 6F7A 696C 6C61 2075 6E64 2049 686E"            /*  Mozilla und Ihn */
	$"656E 2062 657A 9F67 6C69 6368 2064 6573"            /* en bezüglich des */
	$"2056 6572 7472 6167 7367 6567 656E 7374"            /*  Vertragsgegenst */
	$"616E 6465 732C 2075 6E64 2064 6965 7365"            /* andes, und diese */
	$"206B 9A6E 6E65 6E20 6C65 6469 676C 6963"            /*  können lediglic */
	$"6820 6475 7263 6820 6569 6E65 6E20 766F"            /* h durch einen vo */
	$"6E20 4D6F 7A69 6C6C 6120 656E 7473 7072"            /* n Mozilla entspr */
	$"6563 6865 6E64 2061 7574 6F72 6973 6965"            /* echend autorisie */
	$"7274 656D 2056 6572 7472 6574 6572 2064"            /* rtem Vertreter d */
	$"7572 6368 2065 696E 656E 2073 6368 7269"            /* urch einen schri */
	$"6674 6C69 6368 656E 205A 7573 6174 7A20"            /* ftlichen Zusatz  */
	$"6765 8A6E 6465 7274 2077 6572 6465 6E2E"            /* geändert werden. */
	$"2028 6229 2056 6F72 6265 6861 6C74 6C69"            /*  (b) Vorbehaltli */
	$"6368 2065 7665 6E74 7565 6C6C 2061 6E77"            /* ch eventuell anw */
	$"656E 6462 6172 6572 2061 6E64 6572 7320"            /* endbarer anders  */
	$"6C61 7574 656E 6465 7220 6765 7365 747A"            /* lautender gesetz */
	$"6C69 6368 6572 2042 6573 7469 6D6D 756E"            /* licher Bestimmun */
	$"6765 6E2C 2075 6E74 6572 6C69 6567 7420"            /* gen, unterliegt  */
	$"6469 6573 6520 5665 7265 696E 6261 7275"            /* diese Vereinbaru */
	$"6E67 2064 656E 2047 6573 6574 7A65 6E20"            /* ng den Gesetzen  */
	$"6465 7320 5553 2D42 756E 6465 7373 7461"            /* des US-Bundessta */
	$"6174 7320 4B61 6C69 666F 726E 6965 6E20"            /* ats Kalifornien  */
	$"756E 7465 7220 4175 7373 6368 6C75 7373"            /* unter Ausschluss */
	$"2064 6573 204B 6F6C 6C69 7369 6F6E 7372"            /*  des Kollisionsr */
	$"6563 6874 732E 2028 6329 2044 6965 7365"            /* echts. (c) Diese */
	$"2056 6572 6569 6E62 6172 756E 6720 756E"            /*  Vereinbarung un */
	$"7465 726C 6965 6774 206E 6963 6874 2064"            /* terliegt nicht d */
	$"656D 2086 6265 7265 696E 6B6F 6D6D 656E"            /* em Übereinkommen */
	$"2064 6572 2056 6572 6569 6E74 656E 204E"            /*  der Vereinten N */
	$"6174 696F 6E65 6E20 9F62 6572 2056 6572"            /* ationen über Ver */
	$"7472 8A67 6520 9F62 6572 2064 656E 2069"            /* träge über den i */
	$"6E74 6572 6E61 7469 6F6E 616C 656E 2057"            /* nternationalen W */
	$"6172 656E 7665 726B 6175 662E 2028 6429"            /* arenverkauf. (d) */
	$"2053 6F6C 6C74 656E 2054 6569 6C65 2064"            /*  Sollten Teile d */
	$"6965 7365 7220 5665 7265 696E 6261 7275"            /* ieser Vereinbaru */
	$"6E67 2066 9F72 2075 6E67 9F6C 7469 6720"            /* ng für ungültig  */
	$"6F64 6572 206E 6963 6874 2064 7572 6368"            /* oder nicht durch */
	$"7365 747A 6261 7220 6572 6163 6874 6574"            /* setzbar erachtet */
	$"2077 6572 6465 6E2C 2073 6F20 7765 7264"            /*  werden, so werd */
	$"656E 2064 6965 7365 2054 6569 6C65 2067"            /* en diese Teile g */
	$"656D 8AA7 2064 656E 2075 7273 7072 9F6E"            /* emäß den ursprün */
	$"676C 6963 6865 6E20 4162 7369 6368 7465"            /* glichen Absichte */
	$"6E20 6465 7220 5665 7274 7261 6773 7061"            /* n der Vertragspa */
	$"7274 6569 656E 206E 6575 2061 7566 6765"            /* rteien neu aufge */
	$"7365 747A 742C 2075 6E64 2064 6965 2076"            /* setzt, und die v */
	$"6572 626C 6569 6265 6E64 656E 2041 6273"            /* erbleibenden Abs */
	$"6368 6E69 7474 6520 626C 6569 6265 6E20"            /* chnitte bleiben  */
	$"766F 6C6C 756D 668A 6E67 6C69 6368 2076"            /* vollumfänglich v */
	$"6572 6269 6E64 6C69 6368 2E20 2865 2920"            /* erbindlich. (e)  */
	$"4569 6E20 5665 727A 6963 6874 2064 6572"            /* Ein Verzicht der */
	$"2065 696E 656E 206F 6465 7220 616E 6465"            /*  einen oder ande */
	$"7265 6E20 5061 7274 6569 2061 7566 2065"            /* ren Partei auf e */
	$"696E 6520 4265 7374 696D 6D75 6E67 2064"            /* ine Bestimmung d */
	$"6965 7365 7220 5665 7265 696E 6261 7275"            /* ieser Vereinbaru */
	$"6E67 206F 6465 7220 6465 7265 6E20 4E69"            /* ng oder deren Ni */
	$"6368 7465 7266 9F6C 6C75 6E67 207A 7520"            /* chterfüllung zu  */
	$"6972 6765 6E64 6569 6E65 6D20 5A65 6974"            /* irgendeinem Zeit */
	$"7075 6E6B 742C 2073 7465 6C6C 7420 6B65"            /* punkt, stellt ke */
	$"696E 656E 2056 6572 7A69 6368 7420 6175"            /* inen Verzicht au */
	$"6620 6569 6E65 2073 6F6C 6368 6520 4265"            /* f eine solche Be */
	$"7374 696D 6D75 6E67 206F 6465 7220 6569"            /* stimmung oder ei */
	$"6E65 206E 6163 6866 6F6C 6765 6E64 6520"            /* ne nachfolgende  */
	$"4E69 6368 7465 7266 9F6C 6C75 6E67 2065"            /* Nichterfüllung e */
	$"696E 6572 2073 6F6C 6368 656E 2042 6573"            /* iner solchen Bes */
	$"7469 6D6D 756E 6720 6461 722E 2028 6629"            /* timmung dar. (f) */
	$"2056 6F72 6265 6861 6C74 6C69 6368 2064"            /*  Vorbehaltlich d */
	$"6572 2047 6573 6574 7A67 6562 756E 6720"            /* er Gesetzgebung  */
	$"6973 7420 456E 676C 6973 6368 2064 6965"            /* ist Englisch die */
	$"206D 61A7 6765 626C 6963 6865 2053 7072"            /*  maßgebliche Spr */
	$"6163 6865 2064 6965 7365 7220 5665 7265"            /* ache dieser Vere */
	$"696E 6261 7275 6E67 2E20 2867 2920 5369"            /* inbarung. (g) Si */
	$"6520 6B9A 6E6E 656E 2049 6872 6520 696E"            /* e können Ihre in */
	$"2064 6965 7365 7220 5665 7265 696E 6261"            /*  dieser Vereinba */
	$"7275 6E67 2066 6573 7467 6568 616C 7465"            /* rung festgehalte */
	$"6E65 6E20 5265 6368 7465 2061 6E20 6A65"            /* nen Rechte an je */
	$"6465 2061 6E64 6572 6520 5061 7274 6569"            /* de andere Partei */
	$"2061 6274 7265 7465 6E2C 2064 6965 2064"            /*  abtreten, die d */
	$"6965 7365 6E20 4265 7374 696D 6D75 6E67"            /* iesen Bestimmung */
	$"656E 207A 7573 7469 6D6D 7420 756E 6420"            /* en zustimmt und  */
	$"7369 6368 2069 686E 656E 2076 6572 7066"            /* sich ihnen verpf */
	$"6C69 6368 7465 743B 204D 6F7A 696C 6C61"            /* lichtet; Mozilla */
	$"2046 6F75 6E64 6174 696F 6E20 6B61 6E6E"            /*  Foundation kann */
	$"2069 6872 6520 696E 2064 6965 7365 7220"            /*  ihre in dieser  */
	$"5665 7265 696E 6261 7275 6E67 2066 6573"            /* Vereinbarung fes */
	$"7467 6568 616C 7465 6E65 6E20 5265 6368"            /* tgehaltenen Rech */
	$"7465 2062 6564 696E 6775 6E67 736C 6F73"            /* te bedingungslos */
	$"2061 6274 7265 7465 6E2E 2068 2920 4469"            /*  abtreten. h) Di */
	$"6573 6520 5665 7265 696E 6261 7275 6E67"            /* ese Vereinbarung */
	$"2069 7374 2062 696E 6465 6E64 2075 6E64"            /*  ist bindend und */
	$"2077 6972 6B74 207A 7567 756E 7374 656E"            /*  wirkt zugunsten */
	$"2064 6572 2050 6172 7465 6965 6E2C 2069"            /*  der Parteien, i */
	$"6872 6572 2052 6563 6874 736E 6163 6866"            /* hrer Rechtsnachf */
	$"6F6C 6765 7220 756E 6420 4162 7472 6574"            /* olger und Abtret */
	$"756E 6773 656D 7066 8A6E 6765 722E"                 /* ungsempfänger. */
};

data 'styl' (5002, "German SLA") {
	$"0003 0000 0000 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 01A4 000F 000C 0400"            /* .........§...... */
	$"0190 000C 0000 0000 0000 0000 01C7 000F"            /* .ê...........«.. */
	$"000C 0400 0090 000C 0000 0000 0000"                 /* .....ê........ */
};

data 'TEXT' (5003, "Italian SLA") {
	$"5175 6573 7461 208F 2075 6E61 2074 7261"            /* Questa è una tra */
	$"6475 7A69 6F6E 6520 6E6F 6E20 7566 6669"            /* duzione non uffi */
	$"6369 616C 6520 6469 2043 414D 494E 4F20"            /* ciale di CAMINO  */
	$"4555 4C41 2069 6E20 6974 616C 6961 6E6F"            /* EULA in italiano */
	$"2E20 4573 7361 206E 6F6E 2068 6120 7661"            /* . Essa non ha va */
	$"6C6F 7265 206C 6567 616C 6520 7065 7220"            /* lore legale per  */
	$"6166 6665 726D 6172 6520 6920 7465 726D"            /* affermare i term */
	$"696E 6920 6465 6C6C 6120 6C69 6365 6E7A"            /* ini della licenz */
	$"6120 6469 2071 7565 7374 6120 636F 7069"            /* a di questa copi */
	$"6120 6469 2043 414D 494E 4F20 D020 736F"            /* a di CAMINO – so */
	$"6C6F 2069 6C20 7465 7374 6F20 6F72 6967"            /* lo il testo orig */
	$"696E 616C 6520 696E 676C 6573 6520 6469"            /* inale inglese di */
	$"2045 554C 412C 2069 6E63 6C75 736F 2071"            /*  EULA, incluso q */
	$"7569 2073 6F74 746F 2C20 6861 2076 616C"            /* ui sotto, ha val */
	$"6F72 6520 6C65 6761 6C65 2E20 5475 7474"            /* ore legale. Tutt */
	$"6176 6961 2C20 6369 2061 7567 7572 6961"            /* avia, ci auguria */
	$"6D6F 2063 6865 2071 7565 7374 6120 7472"            /* mo che questa tr */
	$"6164 757A 696F 6E65 2070 6F73 7361 2061"            /* aduzione possa a */
	$"6975 7461 7265 206C 6520 7065 7273 6F6E"            /* iutare le person */
	$"6520 6469 206C 696E 6775 6120 6974 616C"            /* e di lingua ital */
	$"6961 6E61 2061 2063 6F6D 7072 656E 6465"            /* iana a comprende */
	$"7265 206D 6567 6C69 6F20 4341 4D49 4E4F"            /* re meglio CAMINO */
	$"2045 554C 412E 0D0D 4143 434F 5244 4F20"            /*  EULA...ACCORDO  */
	$"4449 204C 4943 454E 5A41 2053 4F46 5457"            /* DI LICENZA SOFTW */
	$"4152 4520 5045 5220 4CD5 5554 454E 5445"            /* ARE PER L’UTENTE */
	$"2046 494E 414C 4520 4449 2043 414D 494E"            /*  FINALE DI CAMIN */
	$"4F0D 5665 7273 696F 6E65 2031 2E31 0D0D"            /* O.Versione 1.1.. */
	$"554E 4120 5645 5253 494F 4E45 2044 454C"            /* UNA VERSIONE DEL */
	$"2043 4F44 4943 4520 534F 5247 454E 5445"            /*  CODICE SORGENTE */
	$"2044 4920 4445 5445 524D 494E 4154 4120"            /*  DI DETERMINATA  */
	$"4655 4E5A 494F 4E41 4C49 54CB 2044 454C"            /* FUNZIONALITÀ DEL */
	$"2042 524F 5753 4552 2043 414D 494E 4F2C"            /*  BROWSER CAMINO, */
	$"2043 4845 204C D555 5445 4E54 4520 5055"            /*  CHE L’UTENTE PU */
	$"F120 5553 4152 452C 204D 4F44 4946 4943"            /* Ò USARE, MODIFIC */
	$"4152 4520 4520 4449 5354 5249 4255 4952"            /* ARE E DISTRIBUIR */
	$"452C 20E9 2044 4953 504F 4E49 4249 4C45"            /* E, È DISPONIBILE */
	$"2047 5241 5455 4954 414D 454E 5445 204E"            /*  GRATUITAMENTE N */
	$"454C 2053 4954 4F20 5757 572E 4D4F 5A49"            /* EL SITO WWW.MOZI */
	$"4C4C 412E 4F52 4720 534F 5454 4F20 4C41"            /* LLA.ORG SOTTO LA */
	$"204C 4943 454E 5A41 2050 5542 424C 4943"            /*  LICENZA PUBBLIC */
	$"4120 4D4F 5A49 4C4C 4120 6520 616C 7472"            /* A MOZILLA e altr */
	$"6520 6C69 6365 6E7A 6520 736F 6674 7761"            /* e licenze softwa */
	$"7265 2064 6920 736F 7267 656E 7469 2061"            /* re di sorgenti a */
	$"7065 7274 652E 0D0D 4C61 2076 6572 7369"            /* perte...La versi */
	$"6F6E 6520 6465 6C20 636F 6469 6365 2065"            /* one del codice e */
	$"7365 6775 6962 696C 6520 4341 4D49 4E4F"            /* seguibile CAMINO */
	$"2065 206C 6120 7265 6C61 7469 7661 2064"            /*  e la relativa d */
	$"6F63 756D 656E 7461 7A69 6F6E 6520 2869"            /* ocumentazione (i */
	$"6C20 D250 726F 646F 7474 6FD3 2920 736F"            /* l “Prodotto”) so */
	$"6E6F 2061 2064 6973 706F 7369 7A69 6F6E"            /* no a disposizion */
	$"6520 6465 6C6C D575 7465 6E74 6520 696E"            /* e dell’utente in */
	$"2062 6173 6520 6169 2074 6572 6D69 6E69"            /*  base ai termini */
	$"2064 6920 7175 6573 746F 2041 4343 4F52"            /*  di questo ACCOR */
	$"444F 2044 4920 4C49 4345 4E5A 4120 534F"            /* DO DI LICENZA SO */
	$"4654 5741 5245 2050 4552 204C D555 5445"            /* FTWARE PER L’UTE */
	$"4E54 4520 4649 4E41 4C45 2044 4920 4341"            /* NTE FINALE DI CA */
	$"4D49 4E4F 2028 D24C D541 4343 4F52 444F"            /* MINO (“L’ACCORDO */
	$"D329 2E20 434C 4943 4341 4E44 4F20 494C"            /* ”). CLICCANDO IL */
	$"2054 4153 544F 20D2 4143 4345 5454 4FD3"            /*  TASTO “ACCETTO” */
	$"204F 5050 5552 4520 494E 5354 414C 4C41"            /*  OPPURE INSTALLA */
	$"4E44 4F20 4F20 5553 414E 444F 2049 4C20"            /* NDO O USANDO IL  */
	$"4252 4F57 5345 5220 4341 4D49 4E4F 2C20"            /* BROWSER CAMINO,  */
	$"4CD5 5554 454E 5445 2041 4343 4F4E 5345"            /* L’UTENTE ACCONSE */
	$"4E54 4520 4449 2045 5353 4552 4520 5649"            /* NTE DI ESSERE VI */
	$"4E43 4F4C 4154 4F20 4441 4C4C 4120 4C49"            /* NCOLATO DALLA LI */
	$"4345 4E5A 412E 2053 4520 4CD5 5554 454E"            /* CENZA. SE L’UTEN */
	$"5445 204E 4F4E 2043 4F4E 434F 5244 4120"            /* TE NON CONCORDA  */
	$"434F 4E20 4920 5445 524D 494E 4920 4520"            /* CON I TERMINI E  */
	$"4C45 2043 4F4E 4449 5A49 4F4E 4920 4449"            /* LE CONDIZIONI DI */
	$"2051 5545 5354 4F20 4143 434F 5244 4F2C"            /*  QUESTO ACCORDO, */
	$"204E 4F4E 2044 4556 4520 434C 4943 4341"            /*  NON DEVE CLICCA */
	$"5245 2049 4C20 5441 5354 4F20 D4D4 4143"            /* RE IL TASTO ‘‘AC */
	$"4345 5454 4FD5 D520 4520 4E4F 4E20 4445"            /* CETTO’’ E NON DE */
	$"5645 2049 4E53 5441 4C4C 4152 4520 4F20"            /* VE INSTALLARE O  */
	$"5553 4152 4520 4E45 5353 554E 4120 5041"            /* USARE NESSUNA PA */
	$"5254 4520 4445 4C20 4252 4F57 5345 5220"            /* RTE DEL BROWSER  */
	$"4341 4D49 4E4F 2E20 4455 5241 4E54 4520"            /* CAMINO. DURANTE  */
	$"494C 2050 524F 4345 5353 4F20 4449 2049"            /* IL PROCESSO DI I */
	$"4E53 5441 4C4C 415A 494F 4E45 2043 414D"            /* NSTALLAZIONE CAM */
	$"494E 4F2C 2045 2049 4E20 4655 5455 524F"            /* INO, E IN FUTURO */
	$"2C20 504F 5452 4542 4245 2056 454E 4952"            /* , POTREBBE VENIR */
	$"4520 434F 4E43 4553 5341 204C D54F 505A"            /* E CONCESSA L’OPZ */
	$"494F 4E45 2044 4920 494E 5354 414C 4C41"            /* IONE DI INSTALLA */
	$"5245 2043 4F4D 504F 4E45 4E54 4920 4144"            /* RE COMPONENTI AD */
	$"4449 5A49 4F4E 414C 4920 4441 2046 4F52"            /* DIZIONALI DA FOR */
	$"4E49 544F 5249 2044 4920 534F 4654 5741"            /* NITORI DI SOFTWA */
	$"5245 2044 4920 5445 525A 4120 5041 5254"            /* RE DI TERZA PART */
	$"452E 204C D549 4E53 5441 4C4C 415A 494F"            /* E. L’INSTALLAZIO */
	$"4E45 2045 204C D555 534F 2044 4549 2043"            /* NE E L’USO DEI C */
	$"4F4D 504F 4E45 4E54 4920 4449 2054 4552"            /* OMPONENTI DI TER */
	$"5A41 2050 4152 5445 2C20 504F 5452 4542"            /* ZA PARTE, POTREB */
	$"4245 524F 2045 5353 4552 4520 474F 5645"            /* BERO ESSERE GOVE */
	$"524E 4154 4920 4441 2041 4444 495A 494F"            /* RNATI DA ADDIZIO */
	$"4E41 4C49 2041 4343 4F52 4449 2044 4920"            /* NALI ACCORDI DI  */
	$"4C49 4345 4E5A 412E 0D0D 312E 2043 4F4E"            /* LICENZA...1. CON */
	$"4345 5353 494F 4E45 2044 4920 4C49 4345"            /* CESSIONE DI LICE */
	$"4E5A 412E 204C 6120 4D6F 7A69 6C6C 6120"            /* NZA. La Mozilla  */
	$"466F 756E 6461 7469 6F6E 2063 6F6E 6365"            /* Foundation conce */
	$"6465 2061 6C6C D575 7465 6E74 6520 756E"            /* de all’utente un */
	$"6120 6C69 6365 6E7A 6120 6E6F 6E20 6573"            /* a licenza non es */
	$"636C 7573 6976 6120 7065 7220 7573 6172"            /* clusiva per usar */
	$"6520 6C61 2076 6572 7369 6F6E 6520 696E"            /* e la versione in */
	$"2063 6F64 6963 6520 6573 6567 7569 6269"            /*  codice eseguibi */
	$"6C65 2064 656C 2050 726F 646F 7474 6F2E"            /* le del Prodotto. */
	$"2051 7565 7374 6F20 4163 636F 7264 6F20"            /*  Questo Accordo  */
	$"6465 7465 726D 696E 6572 8820 616E 6368"            /* determinerà anch */
	$"6520 6F67 6E69 2075 7067 7261 6465 2064"            /* e ogni upgrade d */
	$"6920 736F 6674 7761 7265 2066 6F72 6E69"            /* i software forni */
	$"746F 2064 6120 4D6F 7A69 6C6C 612C 2063"            /* to da Mozilla, c */
	$"6865 2073 6F73 7469 7475 6973 6365 2065"            /* he sostituisce e */
	$"2F6F 2069 6E74 6567 7261 2069 6C20 5072"            /* /o integra il Pr */
	$"6F64 6F74 746F 206F 7269 6769 6E61 6C65"            /* odotto originale */
	$"2C20 6120 6D65 6E6F 2063 6865 2074 616C"            /* , a meno che tal */
	$"6920 7570 6772 6164 6520 6E6F 6E20 7369"            /* i upgrade non si */
	$"616E 6F20 6163 636F 6D70 6167 6E61 7469"            /* ano accompagnati */
	$"2064 6120 756E 6120 6C69 6365 6E7A 6120"            /*  da una licenza  */
	$"7365 7061 7261 7461 2C20 6E65 6C20 7175"            /* separata, nel qu */
	$"616C 2063 6173 6F20 7361 7261 6E6E 6F20"            /* al caso saranno  */
	$"6465 7465 726D 696E 616E 7469 2069 2074"            /* determinanti i t */
	$"6572 6D69 6E69 2064 6920 7175 656C 6C61"            /* ermini di quella */
	$"206C 6963 656E 7A61 2E0D 0D32 2E20 5245"            /*  licenza...2. RE */
	$"5343 4953 5349 4F4E 452E 2049 6E20 6361"            /* SCISSIONE. In ca */
	$"736F 2064 6920 7669 6F6C 617A 696F 6E65"            /* so di violazione */
	$"2064 6920 7175 6573 746F 2041 6363 6F72"            /*  di questo Accor */
	$"646F 2064 6120 7061 7274 6520 6465 6C6C"            /* do da parte dell */
	$"D575 7465 6E74 652C 2069 6C20 7375 6F20"            /* ’utente, il suo  */
	$"6469 7269 7474 6F20 6164 2075 7361 7265"            /* diritto ad usare */
	$"2069 6C20 5072 6F64 6F74 746F 2074 6572"            /*  il Prodotto ter */
	$"6D69 6E65 7288 2069 6D6D 6564 6961 7461"            /* minerà immediata */
	$"6D65 6E74 6520 6520 7365 6E7A 6120 616C"            /* mente e senza al */
	$"6375 6E61 206E 6F74 6966 6963 6120 6D61"            /* cuna notifica ma */
	$"2074 7574 7465 206C 6520 636F 6E64 697A"            /*  tutte le condiz */
	$"696F 6E69 2064 6920 7175 6573 746F 2041"            /* ioni di questo A */
	$"6363 6F72 646F 2061 6420 6563 6365 7A69"            /* ccordo ad eccezi */
	$"6F6E 6520 6465 6C6C 6120 436F 6E63 6573"            /* one della Conces */
	$"7369 6F6E 6520 6469 204C 6963 656E 7A61"            /* sione di Licenza */
	$"2028 7061 7261 6772 6166 6F20 3129 2C20"            /*  (paragrafo 1),  */
	$"7265 7374 6572 616E 6E6F 2069 6E20 7669"            /* resteranno in vi */
	$"676F 7265 2065 2073 6F70 7261 7676 6976"            /* gore e sopravviv */
	$"7261 6E6E 6F20 616C 6C61 2072 6573 6369"            /* ranno alla resci */
	$"7373 696F 6E65 2E20 5375 6269 746F 2064"            /* ssione. Subito d */
	$"6F70 6F20 6C61 2072 6573 6369 7373 696F"            /* opo la rescissio */
	$"6E65 2C20 6CD5 7574 656E 7465 2064 6576"            /* ne, l’utente dev */
	$"6520 6469 7374 7275 6767 6572 6520 7475"            /* e distruggere tu */
	$"7474 6520 6C65 2063 6F70 6965 2064 656C"            /* tte le copie del */
	$"2050 726F 646F 7474 6F2E 0D0D 332E 2044"            /*  Prodotto...3. D */
	$"4952 4954 5449 2044 4920 5052 4F50 5249"            /* IRITTI DI PROPRI */
	$"4554 CB2E 2050 6172 7469 2064 656C 2050"            /* ETÀ. Parti del P */
	$"726F 646F 7474 6F20 736F 6E6F 2064 6973"            /* rodotto sono dis */
	$"706F 6E69 6269 6C69 2073 6F74 746F 2066"            /* ponibili sotto f */
	$"6F72 6D61 2064 6920 636F 6469 6365 2073"            /* orma di codice s */
	$"6F72 6765 6E74 6520 696E 2062 6173 6520"            /* orgente in base  */
	$"6169 2074 6572 6D69 6E69 2064 656C 6C61"            /* ai termini della */
	$"204C 6963 656E 7A61 2050 7562 626C 6963"            /*  Licenza Pubblic */
	$"6120 4D6F 7A69 6C6C 6120 6564 2061 6C74"            /* a Mozilla ed alt */
	$"7265 206C 6963 656E 7A65 206F 7065 6E20"            /* re licenze open  */
	$"736F 7572 6365 2028 636F 6C6C 6574 7469"            /* source (colletti */
	$"7661 6D65 6E74 65D3 4C69 6365 6E7A 6520"            /* vamente”Licenze  */
	$"4F70 656E 2053 6F75 7263 65D3 2920 6120"            /* Open Source”) a  */
	$"6874 7470 3A2F 2F77 7777 2E6D 6F7A 696C"            /* http://www.mozil */
	$"6C61 2E6F 7267 2E20 4E75 6C6C 6120 696E"            /* la.org. Nulla in */
	$"2071 7565 7374 6F20 4163 636F 7264 6F20"            /*  questo Accordo  */
	$"7665 7272 8820 7573 6174 6F20 7065 7220"            /* verrà usato per  */
	$"6C69 6D69 7461 7265 2071 7561 6C73 6961"            /* limitare qualsia */
	$"7369 2064 6972 6974 746F 2063 6F6E 6365"            /* si diritto conce */
	$"7373 6F20 6461 6C6C 6520 4C69 6365 6E7A"            /* sso dalle Licenz */
	$"6520 4F70 656E 2053 6F75 7263 652E 2053"            /* e Open Source. S */
	$"6F67 6765 7474 6F20 616C 2070 7265 6365"            /* oggetto al prece */
	$"6465 6E74 652C 204D 6F7A 696C 6C61 2C20"            /* dente, Mozilla,  */
	$"6461 2070 6172 7465 2073 7561 2065 2064"            /* da parte sua e d */
	$"6569 2073 756F 6920 636F 6E63 6573 736F"            /* ei suoi concesso */
	$"7269 2064 6920 6C69 6365 6E7A 612C 2073"            /* ri di licenza, s */
	$"6920 7269 7365 7276 6120 636F 6E20 6369"            /* i riserva con ci */
	$"9820 7475 7474 6920 6920 6469 7269 7474"            /* ò tutti i diritt */
	$"6920 6469 2070 726F 7072 6965 7488 2069"            /* i di proprietà i */
	$"6E74 656C 6C65 7474 7561 6C65 2064 656C"            /* ntellettuale del */
	$"2070 726F 646F 7474 6F2C 2061 6420 6563"            /*  prodotto, ad ec */
	$"6365 7A69 6F6E 6520 6465 6920 6469 7269"            /* cezione dei diri */
	$"7474 6920 636F 6E63 6573 7369 2065 7370"            /* tti concessi esp */
	$"7265 7373 616D 656E 7465 2069 6E20 7175"            /* ressamente in qu */
	$"6573 746F 2041 6363 6F72 646F 2E20 4CD5"            /* esto Accordo. L’ */
	$"7574 656E 7465 206E 6F6E 2070 7598 2072"            /* utente non può r */
	$"696D 756F 7665 7265 206F 2061 6C74 6572"            /* imuovere o alter */
	$"6172 6520 6E65 7373 756E 206D 6172 6368"            /* are nessun march */
	$"696F 2063 6F6D 6D65 7263 6961 6C65 2C20"            /* io commerciale,  */
	$"6C6F 676F 2C20 636F 7079 7269 6768 7420"            /* logo, copyright  */
	$"6F20 616C 7472 6120 6E6F 7469 6669 6361"            /* o altra notifica */
	$"2064 6920 7072 6F70 7269 6574 8820 6E65"            /*  di proprietà ne */
	$"6C20 6520 7375 6C20 5072 6F64 6F74 746F"            /* l e sul Prodotto */
	$"2E20 5175 6573 7461 206C 6963 656E 7A61"            /* . Questa licenza */
	$"206E 6F6E 2063 6F6E 6365 6465 206E 6573"            /*  non concede nes */
	$"7375 6E20 6469 7269 7474 6F20 616C 6CD5"            /* sun diritto all’ */
	$"7573 6F20 6465 6C20 6D61 7263 6869 6F20"            /* uso del marchio  */
	$"636F 6D6D 6572 6369 616C 652C 2064 6569"            /* commerciale, dei */
	$"206D 6172 6368 6920 6469 2073 6572 7669"            /*  marchi di servi */
	$"7A69 6F20 6520 6465 6920 6C6F 6768 6920"            /* zio e dei loghi  */
	$"6469 204D 6F7A 696C 6C61 206F 2064 6569"            /* di Mozilla o dei */
	$"2073 756F 6920 636F 6E63 6573 736F 7269"            /*  suoi concessori */
	$"2064 6920 6C69 6365 6E7A 612E 0D0D 342E"            /*  di licenza...4. */
	$"2045 5343 4C55 5349 4F4E 4520 4449 2047"            /*  ESCLUSIONE DI G */
	$"4152 414E 5A49 412E 2049 4C20 5052 4F44"            /* ARANZIA. IL PROD */
	$"4F54 544F 2056 4945 4E45 2046 4F52 4E49"            /* OTTO VIENE FORNI */
	$"544F 20D2 434F 53ED 2043 4F4D 4520 E9D3"            /* TO “COSÌ COME È” */
	$"2043 4F4E 2054 5554 5449 2047 4C49 2045"            /*  CON TUTTI GLI E */
	$"5252 4F52 492E 2049 4E20 4241 5345 2041"            /* RRORI. IN BASE A */
	$"4C4C 4520 4E4F 524D 4520 4449 204C 4547"            /* LLE NORME DI LEG */
	$"4745 2056 4947 454E 5449 2C20 4D4F 5A49"            /* GE VIGENTI, MOZI */
	$"4C4C 4120 4520 4920 4449 5354 5249 4255"            /* LLA E I DISTRIBU */
	$"544F 5249 2044 4920 4D4F 5A49 4C4C 412C"            /* TORI DI MOZILLA, */
	$"2049 2043 4F4E 4345 5353 4F52 4920 4449"            /*  I CONCESSORI DI */
	$"204C 4943 454E 5A41 204E 4547 414E 4F20"            /*  LICENZA NEGANO  */
	$"434F 4E20 4349 F120 5455 5454 4520 4C45"            /* CON CIÒ TUTTE LE */
	$"2047 4152 414E 5A49 452C 2045 5350 4C49"            /*  GARANZIE, ESPLI */
	$"4349 5445 2045 2049 4D50 4C49 4349 5445"            /* CITE E IMPLICITE */
	$"2C20 434F 4D50 5245 5345 2053 454E 5A41"            /* , COMPRESE SENZA */
	$"204C 494D 4954 452C 204C 4520 4741 5241"            /*  LIMITE, LE GARA */
	$"4E5A 4945 2043 4845 2049 4C20 5052 4F44"            /* NZIE CHE IL PROD */
	$"4F54 544F 20E9 2050 5249 564F 2044 4920"            /* OTTO È PRIVO DI  */
	$"4449 4645 5454 492C 2043 4F4D 4D45 5243"            /* DIFETTI, COMMERC */
	$"4941 4249 4C45 2C20 4944 4F4E 454F 2041"            /* IABILE, IDONEO A */
	$"4420 554E 2050 4152 5449 434F 4C41 5245"            /* D UN PARTICOLARE */
	$"2046 494E 4520 4520 4E4F 4E20 5649 4F4C"            /*  FINE E NON VIOL */
	$"4142 494C 452E 204C D555 5445 4E54 4520"            /* ABILE. L’UTENTE  */
	$"5349 2041 5353 554D 4520 4CD5 494E 5445"            /* SI ASSUME L’INTE */
	$"524F 2052 4953 4348 494F 2053 4941 204E"            /* RO RISCHIO SIA N */
	$"454C 4C41 2053 4345 4C54 4120 4445 4C20"            /* ELLA SCELTA DEL  */
	$"5052 4F44 4F54 544F 2050 4552 2049 2053"            /* PRODOTTO PER I S */
	$"554F 4920 4649 4E49 2043 4845 2050 4552"            /* UOI FINI CHE PER */
	$"204C 4120 5155 414C 4954 CB20 4520 494C"            /*  LA QUALITÀ E IL */
	$"2052 454E 4449 4D45 4E54 4F20 4445 4C20"            /*  RENDIMENTO DEL  */
	$"5052 4F44 4F54 544F 2E20 5155 4553 5441"            /* PRODOTTO. QUESTA */
	$"204C 494D 4954 415A 494F 4E45 2053 4152"            /*  LIMITAZIONE SAR */
	$"CB20 5641 4C49 4441 204E 4F4E 4F53 5441"            /* À VALIDA NONOSTA */
	$"4E54 4520 494C 2046 414C 4C49 4D45 4E54"            /* NTE IL FALLIMENT */
	$"4F20 4445 4C4C 4F20 5343 4F50 4F20 4553"            /* O DELLO SCOPO ES */
	$"5345 4E5A 4941 4C45 2044 4920 5155 414C"            /* SENZIALE DI QUAL */
	$"5349 4153 4920 5449 504F 2044 4920 5249"            /* SIASI TIPO DI RI */
	$"5041 5241 5A49 4F4E 452E 2041 4C43 554E"            /* PARAZIONE. ALCUN */
	$"4520 4749 5552 4953 4449 5A49 4F4E 4920"            /* E GIURISDIZIONI  */
	$"4E4F 4E20 434F 4E53 454E 544F 4E4F 204C"            /* NON CONSENTONO L */
	$"D545 5343 4C55 5349 4F4E 4520 4F20 4C41"            /* ’ESCLUSIONE O LA */
	$"204C 494D 4954 415A 494F 4E45 2044 454C"            /*  LIMITAZIONE DEL */
	$"4C45 2047 4152 414E 5A49 4520 494D 504C"            /* LE GARANZIE IMPL */
	$"4943 4954 452C 2045 2051 5549 4E44 4920"            /* ICITE, E QUINDI  */
	$"5155 4553 5441 2043 4C41 5553 4F4C 4120"            /* QUESTA CLAUSOLA  */
	$"504F 5452 4542 4245 204E 4F4E 2045 5353"            /* POTREBBE NON ESS */
	$"4552 4520 5641 4C49 4441 2050 4552 204C"            /* ERE VALIDA PER L */
	$"D555 5445 4E54 452E 0D0D 352E 204C 494D"            /* ’UTENTE...5. LIM */
	$"4954 415A 494F 4E45 2044 4920 5245 5350"            /* ITAZIONE DI RESP */
	$"4F4E 5341 4249 4C49 54CB 2E20 4144 2045"            /* ONSABILITÀ. AD E */
	$"4343 455A 494F 4E45 2044 4920 5155 454C"            /* CCEZIONE DI QUEL */
	$"4C41 2050 5245 5649 5354 4120 5045 5220"            /* LA PREVISTA PER  */
	$"4C45 4747 452C 204D 4F5A 494C 4C41 2045"            /* LEGGE, MOZILLA E */
	$"2049 2053 554F 4920 4449 5354 5249 4255"            /*  I SUOI DISTRIBU */
	$"544F 5249 2C20 4449 5245 5454 4F52 492C"            /* TORI, DIRETTORI, */
	$"2043 4F4E 4345 5353 4F52 4920 4449 204C"            /*  CONCESSORI DI L */
	$"4943 454E 5A41 2C20 434F 4E54 5249 4255"            /* ICENZA, CONTRIBU */
	$"454E 5449 2045 2041 4745 4E54 4920 2843"            /* ENTI E AGENTI (C */
	$"4F4C 4C45 5454 4956 414D 454E 5445 2049"            /* OLLETTIVAMENTE I */
	$"4C20 D247 5255 5050 4F20 4D4F 5A49 4C4C"            /* L “GRUPPO MOZILL */
	$"41D3 2920 4E4F 4E20 5341 5241 4E4E 4F20"            /* A”) NON SARANNO  */
	$"5245 5350 4F4E 5341 4249 4C49 2050 4552"            /* RESPONSABILI PER */
	$"204E 4553 5355 4E20 4441 4E4E 4F20 494E"            /*  NESSUN DANNO IN */
	$"4449 5245 5454 4F2C 2053 5045 4349 414C"            /* DIRETTO, SPECIAL */
	$"452C 2049 4E43 4944 454E 5441 4C45 2C20"            /* E, INCIDENTALE,  */
	$"434F 4E53 4551 5545 4E5A 4941 4C45 204F"            /* CONSEQUENZIALE O */
	$"2045 5345 4D50 4C41 5245 2043 4845 2050"            /*  ESEMPLARE CHE P */
	$"524F 5649 454E 4520 4F20 E920 494E 2051"            /* ROVIENE O È IN Q */
	$"5541 4C43 4845 204D 4F44 4F20 5245 4C41"            /* UALCHE MODO RELA */
	$"5A49 4F4E 4154 4F20 4120 5155 4553 544F"            /* ZIONATO A QUESTO */
	$"2041 4343 4F52 444F 204F 2041 4C4C D555"            /*  ACCORDO O ALL’U */
	$"534F 204F 2041 4C4C D549 4E43 4150 4143"            /* SO O ALL’INCAPAC */
	$"4954 CB20 4449 2055 5341 5245 2051 5545"            /* ITÀ DI USARE QUE */
	$"5354 4F20 5052 4F44 4F54 544F 2C20 434F"            /* STO PRODOTTO, CO */
	$"4D50 5245 5349 2053 454E 5A41 204C 494D"            /* MPRESI SENZA LIM */
	$"4954 415A 494F 4E45 2049 2044 414E 4E49"            /* ITAZIONE I DANNI */
	$"2050 4552 204C 4120 5045 5244 4954 4120"            /*  PER LA PERDITA  */
	$"4445 4C4C 4120 5245 5055 5441 5A49 4F4E"            /* DELLA REPUTAZION */
	$"452C 204C 4120 5045 5244 4954 4120 4445"            /* E, LA PERDITA DE */
	$"4C20 4C41 564F 524F 2C20 4C41 2050 4552"            /* L LAVORO, LA PER */
	$"4449 5441 2044 4549 2050 524F 4649 5454"            /* DITA DEI PROFITT */
	$"492C 204C 4120 5045 5244 4954 4120 4445"            /* I, LA PERDITA DE */
	$"4920 4441 5449 2045 2050 4552 2049 4C20"            /* I DATI E PER IL  */
	$"4755 4153 544F 204F 2049 4C20 4D41 4C46"            /* GUASTO O IL MALF */
	$"554E 5A49 4F4E 414D 454E 544F 2044 454C"            /* UNZIONAMENTO DEL */
	$"2043 4F4D 5055 5445 522C 2041 4E43 4845"            /*  COMPUTER, ANCHE */
	$"2053 4520 534F 4E4F 2053 5441 5449 2041"            /*  SE SONO STATI A */
	$"5656 4953 4154 4920 4445 4C4C 4120 504F"            /* VVISATI DELLA PO */
	$"5353 4942 494C 4954 CB20 4449 2054 414C"            /* SSIBILITÀ DI TAL */
	$"4920 4441 4E4E 4920 4520 5345 4E5A 4120"            /* I DANNI E SENZA  */
	$"5249 4755 4152 444F 2050 4552 204C 4120"            /* RIGUARDO PER LA  */
	$"5445 4F52 4941 2028 434F 4E54 5241 5454"            /* TEORIA (CONTRATT */
	$"4F2C 2049 4C4C 4543 4954 4F20 4520 414C"            /* O, ILLECITO E AL */
	$"5452 4F29 2053 554C 4C41 2051 5541 4C45"            /* TRO) SULLA QUALE */
	$"2053 4920 4241 5341 2051 5545 5354 4F20"            /*  SI BASA QUESTO  */
	$"5245 434C 414D 4F2E 204C 4120 5245 5350"            /* RECLAMO. LA RESP */
	$"4F4E 5341 4249 4C49 54CB 2043 4F4C 4C45"            /* ONSABILITÀ COLLE */
	$"5454 4956 4120 4445 4C20 4752 5550 504F"            /* TTIVA DEL GRUPPO */
	$"204D 4F5A 494C 4C41 2049 4E20 4241 5345"            /*  MOZILLA IN BASE */
	$"2041 2051 5545 5354 4F20 4143 434F 5244"            /*  A QUESTO ACCORD */
	$"4F2C 204E 4F4E 2053 5550 4552 4552 CB20"            /* O, NON SUPERERÀ  */
	$"4CD5 494D 504F 5254 4F20 4449 2035 3030"            /* L’IMPORTO DI 500 */
	$"2420 2843 494E 5155 4543 454E 544F 2044"            /* $ (CINQUECENTO D */
	$"4F4C 4C41 5249 2920 4520 4C45 2053 5045"            /* OLLARI) E LE SPE */
	$"5345 2050 4147 4154 4520 4441 4C4C D555"            /* SE PAGATE DALL’U */
	$"5445 4E54 4520 4149 2053 454E 5349 2044"            /* TENTE AI SENSI D */
	$"4920 5155 4553 5441 204C 4943 454E 5A41"            /* I QUESTA LICENZA */
	$"2028 5345 2044 454C 2043 4153 4F29 2E20"            /*  (SE DEL CASO).  */
	$"414C 4355 4E45 2047 4955 5249 5344 495A"            /* ALCUNE GIURISDIZ */
	$"494F 4E49 204E 4F4E 2043 4F4E 5345 4E54"            /* IONI NON CONSENT */
	$"4F4E 4F20 4CD5 4553 434C 5553 494F 4E45"            /* ONO L’ESCLUSIONE */
	$"204F 204C 4120 4C49 4D49 5441 5A49 4F4E"            /*  O LA LIMITAZION */
	$"4520 4445 4920 4441 4E4E 4920 494E 4349"            /* E DEI DANNI INCI */
	$"4445 4E54 414C 492C 2043 4F4E 5345 5155"            /* DENTALI, CONSEQU */
	$"454E 5A49 414C 4920 4F20 5350 4543 4941"            /* ENZIALI O SPECIA */
	$"4C49 2045 2051 5549 4E44 4920 5155 4553"            /* LI E QUINDI QUES */
	$"5441 2045 5343 4C55 5349 4F4E 4520 4520"            /* TA ESCLUSIONE E  */
	$"4C49 4D49 5441 5A49 4F4E 4520 504F 5452"            /* LIMITAZIONE POTR */
	$"4542 4245 204E 4F4E 2045 5353 4552 4520"            /* EBBE NON ESSERE  */
	$"5641 4C49 4441 2050 4552 204C D555 5445"            /* VALIDA PER L’UTE */
	$"4E54 452E 0D0D 362E 2043 4F4E 5452 4F4C"            /* NTE...6. CONTROL */
	$"4C49 2050 4552 204C D545 5350 4F52 5441"            /* LI PER L’ESPORTA */
	$"5A49 4F4E 452E 2051 7565 7374 6120 6C69"            /* ZIONE. Questa li */
	$"6365 6E7A 6120 8F20 736F 6767 6574 7461"            /* cenza è soggetta */
	$"2061 2074 7574 7465 206C 6520 7265 7374"            /*  a tutte le rest */
	$"7269 7A69 6F6E 6920 696E 2076 6967 6F72"            /* rizioni in vigor */
	$"6520 7375 6C6C D565 7370 6F72 7461 7A69"            /* e sull’esportazi */
	$"6F6E 652E 204C D575 7465 6E74 6520 6465"            /* one. L’utente de */
	$"7665 2072 6973 7065 7474 6172 6520 7475"            /* ve rispettare tu */
	$"7474 6520 6C65 206C 6567 6769 2065 206C"            /* tte le leggi e l */
	$"6520 7265 7374 7269 7A69 6F6E 6920 7375"            /* e restrizioni su */
	$"6C6C D565 7370 6F72 7461 7A69 6F6E 6520"            /* ll’esportazione  */
	$"6520 7375 6C6C D569 6D70 6F72 7461 7A69"            /* e sull’importazi */
	$"6F6E 6520 6520 6C65 206E 6F72 6D65 2064"            /* one e le norme d */
	$"6920 7175 616C 7369 6173 6920 656E 7465"            /* i qualsiasi ente */
	$"2073 7461 7475 6E69 7465 6E73 6520 6F20"            /*  statunitense o  */
	$"7374 7261 6E69 6572 6F20 6F20 6175 746F"            /* straniero o auto */
	$"7269 7488 2072 656C 617A 696F 6E61 7461"            /* rità relazionata */
	$"2061 6C20 5072 6F64 6F74 746F 2065 2061"            /*  al Prodotto e a */
	$"6C20 7375 6F20 7573 6F2E 2037 2E20 5554"            /* l suo uso. 7. UT */
	$"454E 5449 2046 494E 414C 4920 4445 4C20"            /* ENTI FINALI DEL  */
	$"474F 5645 524E 4F20 552E 532E 412E 2049"            /* GOVERNO U.S.A. I */
	$"6C20 5072 6F64 6F74 746F 208F 2075 6E20"            /* l Prodotto è un  */
	$"D261 7274 6963 6F6C 6F20 636F 6D6D 6572"            /* “articolo commer */
	$"6369 616C 65D3 2C20 636F 6D65 2064 6566"            /* ciale”, come def */
	$"696E 6974 6F20 6E65 6C20 3438 2043 2E46"            /* inito nel 48 C.F */
	$"2E52 2E20 322E 3130 312C 2063 6F6D 706F"            /* .R. 2.101, compo */
	$"7374 6F20 6469 20D2 736F 6674 7761 7265"            /* sto di “software */
	$"2070 6572 2063 6F6D 7075 7465 7220 636F"            /*  per computer co */
	$"6D6D 6572 6369 616C 65D3 2065 20D2 646F"            /* mmerciale” e “do */
	$"6375 6D65 6E74 617A 696F 6E65 2064 6920"            /* cumentazione di  */
	$"736F 6674 7761 7265 2070 6572 2063 6F6D"            /* software per com */
	$"7075 7465 7220 636F 6D6D 6572 6369 616C"            /* puter commercial */
	$"69D3 2C20 696E 2062 6173 6520 6120 636F"            /* i”, in base a co */
	$"6D65 2071 7565 7374 6920 7465 726D 696E"            /* me questi termin */
	$"6920 736F 6E6F 2075 7361 7469 206E 656C"            /* i sono usati nel */
	$"2034 3820 432E 462E 522E 2031 322E 3231"            /*  48 C.F.R. 12.21 */
	$"3220 2853 6574 7465 6D62 7265 2031 3939"            /* 2 (Settembre 199 */
	$"3529 2061 6E64 2034 3820 432E 462E 522E"            /* 5) and 48 C.F.R. */
	$"2032 3237 2E37 3230 3220 2847 6975 676E"            /*  227.7202 (Giugn */
	$"6F20 3139 3935 292E 2049 6E20 6163 636F"            /* o 1995). In acco */
	$"7264 6F20 636F 6E20 3438 2043 2E46 2E52"            /* rdo con 48 C.F.R */
	$"2E20 3132 2E32 3132 2C20 3438 2043 2E46"            /* . 12.212, 48 C.F */
	$"2E52 2E20 3237 2E34 3035 2862 2928 3229"            /* .R. 27.405(b)(2) */
	$"2028 4769 7567 6E6F 2031 3939 3829 2065"            /*  (Giugno 1998) e */
	$"2034 3820 432E 462E 522E 2032 3237 2E37"            /*  48 C.F.R. 227.7 */
	$"3230 322C 2074 7574 7469 2067 6C69 2055"            /* 202, tutti gli U */
	$"7465 6E74 6920 4669 6E61 6C69 2064 656C"            /* tenti Finali del */
	$"2047 6F76 6572 6E6F 2055 2E53 2E41 2E20"            /*  Governo U.S.A.  */
	$"6163 7175 6973 7461 6E6F 2069 6C20 5072"            /* acquistano il Pr */
	$"6F64 6F74 746F 2063 6F6E 2073 6F6C 6F20"            /* odotto con solo  */
	$"7175 6569 2064 6972 6974 7469 2C20 6368"            /* quei diritti, ch */
	$"6520 736F 6E6F 2073 7461 7469 2071 7569"            /* e sono stati qui */
	$"2065 7370 6F73 7469 2E0D 0D38 2E20 5641"            /*  esposti...8. VA */
	$"5249 452E 2028 6129 2051 7565 7374 6F20"            /* RIE. (a) Questo  */
	$"4163 636F 7264 6F20 636F 7374 6974 7569"            /* Accordo costitui */
	$"7363 6520 6CD5 696E 7465 726F 2061 6363"            /* sce l’intero acc */
	$"6F72 646F 2074 7261 204D 6F7A 696C 6C61"            /* ordo tra Mozilla */
	$"2065 206C D575 7465 6E74 6520 7375 2071"            /*  e l’utente su q */
	$"7561 6E74 6F20 7175 6920 7370 6563 6966"            /* uanto qui specif */
	$"6963 6174 6F20 6520 7075 9820 6573 7365"            /* icato e può esse */
	$"7265 206D 6F64 6966 6963 6174 6F20 736F"            /* re modificato so */
	$"6C6F 2064 6120 756E 2065 6D65 6E64 616D"            /* lo da un emendam */
	$"656E 746F 2073 6372 6974 746F 2065 2066"            /* ento scritto e f */
	$"6972 6D61 746F 2064 6120 756E 2066 756E"            /* irmato da un fun */
	$"7A69 6F6E 6172 696F 2061 7574 6F72 697A"            /* zionario autoriz */
	$"7A61 746F 2064 6920 4D6F 7A69 6C6C 612E"            /* zato di Mozilla. */
	$"2028 6229 2041 6420 6563 6365 7A69 6F6E"            /*  (b) Ad eccezion */
	$"6520 6465 6C6C 6520 6E6F 726D 6520 6469"            /* e delle norme di */
	$"206C 6567 6765 2076 6967 656E 7469 2C20"            /*  legge vigenti,  */
	$"7365 206E 6520 6573 6973 746F 6E6F 2C20"            /* se ne esistono,  */
	$"6368 6520 7072 6576 6564 6F6E 6F20 6469"            /* che prevedono di */
	$"7665 7273 616D 656E 7465 2C20 7175 6573"            /* versamente, ques */
	$"746F 2041 6363 6F72 646F 208F 2073 6F67"            /* to Accordo è sog */
	$"6765 7474 6F20 616C 6C65 206C 6567 6769"            /* getto alle leggi */
	$"2064 656C 6C6F 2073 7461 746F 2064 656C"            /*  dello stato del */
	$"6C61 2043 616C 6966 6F72 6E69 612C 2055"            /* la California, U */
	$"2E53 2E41 2E2C 2061 6420 6573 636C 7573"            /* .S.A., ad esclus */
	$"696F 6E65 2064 6569 2073 756F 6920 636F"            /* ione dei suoi co */
	$"6E66 6C69 7474 6920 6469 2061 7070 6C69"            /* nflitti di appli */
	$"6361 7A69 6F6E 6520 6465 6C6C 6520 6C65"            /* cazione delle le */
	$"6767 692E 2028 6329 2051 7565 7374 6F20"            /* ggi. (c) Questo  */
	$"4163 636F 7264 6F20 6E6F 6E20 7669 656E"            /* Accordo non vien */
	$"6520 6469 7363 6970 6C69 6E61 746F 2064"            /* e disciplinato d */
	$"616C 6C61 2043 6F6E 7665 6E7A 696F 6E65"            /* alla Convenzione */
	$"2064 656C 6C65 204E 617A 696F 6E69 2055"            /*  delle Nazioni U */
	$"6E69 7465 2073 7569 2043 6F6E 7472 6174"            /* nite sui Contrat */
	$"7469 2070 6572 206C 6120 5665 6E64 6974"            /* ti per la Vendit */
	$"6120 496E 7465 726E 617A 696F 6E61 6C65"            /* a Internazionale */
	$"2064 6920 4265 6E69 2E20 2864 2920 5365"            /*  di Beni. (d) Se */
	$"2075 6E61 2071 7561 6C73 6961 7369 2070"            /*  una qualsiasi p */
	$"6172 7465 2064 6920 7175 6573 746F 2041"            /* arte di questo A */
	$"6363 6F72 646F 208F 2072 6974 656E 7574"            /* ccordo è ritenut */
	$"6120 6E6F 6E20 7661 6C69 6461 206F 7070"            /* a non valida opp */
	$"7572 6520 6E6F 6E20 6170 706C 6963 6162"            /* ure non applicab */
	$"696C 652C 2071 7565 6C6C 6120 7061 7274"            /* ile, quella part */
	$"6520 7361 7288 2069 6E74 6572 7072 6574"            /* e sarà interpret */
	$"6174 6120 7065 7220 7269 666C 6574 7465"            /* ata per riflette */
	$"7265 206C D569 6E74 656E 746F 206F 7269"            /* re l’intento ori */
	$"6769 6E61 6C65 2064 656C 6C65 2070 6172"            /* ginale delle par */
	$"7469 2065 206C 6520 7061 7274 6920 7269"            /* ti e le parti ri */
	$"6D61 6E65 6E74 6920 7265 7374 6572 616E"            /* manenti resteran */
	$"6E6F 2069 6E20 7669 676F 7265 2061 2074"            /* no in vigore a t */
	$"7574 7469 2067 6C69 2065 6666 6574 7469"            /* utti gli effetti */
	$"2E20 2865 2920 556E 2061 7474 6F20 6469"            /* . (e) Un atto di */
	$"2072 696E 756E 6369 6120 6461 2070 6172"            /*  rinuncia da par */
	$"7465 2064 6920 756E 6120 6465 6C6C 6520"            /* te di una delle  */
	$"7061 7274 6920 6469 2075 6E20 7465 726D"            /* parti di un term */
	$"696E 6520 6F20 6469 2075 6E61 2063 6F6E"            /* ine o di una con */
	$"6469 7A69 6F6E 6520 6469 2071 7565 7374"            /* dizione di quest */
	$"6F20 4163 636F 7264 6F20 6F20 6469 2071"            /* o Accordo o di q */
	$"7561 6C73 6961 7369 2076 696F 6C61 7A69"            /* ualsiasi violazi */
	$"6F6E 6520 6469 2071 7565 7374 6F2C 2069"            /* one di questo, i */
	$"6E20 7175 616C 7369 6173 6920 6F63 6361"            /* n qualsiasi occa */
	$"7369 6F6E 652C 206E 6F6E 2061 6E6E 756C"            /* sione, non annul */
	$"6C61 206C 6120 7661 6C69 6469 7488 2064"            /* la la validità d */
	$"6920 7461 6C65 2074 6572 6D69 6E65 206F"            /* i tale termine o */
	$"2063 6F6E 6469 7A69 6F6E 6520 6F20 7175"            /*  condizione o qu */
	$"616C 7369 6173 6920 7375 6363 6573 7369"            /* alsiasi successi */
	$"7661 2073 7561 2076 696F 6C61 7A69 6F6E"            /* va sua violazion */
	$"652E 2028 6629 2041 6420 6563 6365 7A69"            /* e. (f) Ad eccezi */
	$"6F6E 6520 6469 2071 7561 6E74 6F20 7072"            /* one di quanto pr */
	$"6576 6973 746F 2070 6572 206C 6567 6765"            /* evisto per legge */
	$"2C20 6C61 206C 696E 6775 6120 7072 696E"            /* , la lingua prin */
	$"6369 7061 6C65 2064 6920 7175 6573 746F"            /* cipale di questo */
	$"2041 6363 6F72 646F 208F 206C D549 6E67"            /*  Accordo è l’Ing */
	$"6C65 7365 2E20 2867 2920 4C65 6920 7075"            /* lese. (g) Lei pu */
	$"9820 6166 6669 6461 7265 2069 2053 756F"            /* ò affidare i Suo */
	$"6920 6469 7269 7474 6920 7072 6576 6973"            /* i diritti previs */
	$"7469 2069 6E20 7175 6573 746F 2041 6363"            /* ti in questo Acc */
	$"6F72 646F 2061 2071 7561 6C73 6961 7369"            /* ordo a qualsiasi */
	$"2070 6172 7465 2063 6865 2061 6363 6F6E"            /*  parte che accon */
	$"7365 6E74 6520 6520 6163 6365 7474 6120"            /* sente e accetta  */
	$"6469 2065 7373 6572 6520 7669 6E63 6F6C"            /* di essere vincol */
	$"6174 6120 6461 6920 7375 6F69 2074 6572"            /* ata dai suoi ter */
	$"6D69 6E69 3B20 6C61 204D 6F7A 696C 6C61"            /* mini; la Mozilla */
	$"2046 6F75 6E64 6174 696F 6E20 7075 9820"            /*  Foundation può  */
	$"6166 6669 6461 7265 2069 2073 756F 6920"            /* affidare i suoi  */
	$"6469 7269 7474 6920 7072 6576 6973 7469"            /* diritti previsti */
	$"2069 6E20 7175 6573 746F 2041 6363 6F72"            /*  in questo Accor */
	$"646F 2073 656E 7A61 2063 6F6E 6469 7A69"            /* do senza condizi */
	$"6F6E 692E 2868 2920 5175 6573 746F 2041"            /* oni.(h) Questo A */
	$"6363 6F72 646F 2073 6172 8820 7669 6E63"            /* ccordo sarà vinc */
	$"6F6C 616E 7465 2065 2065 6E74 7265 7288"            /* olante e entrerà */
	$"2069 6E20 7669 676F 7265 2061 2062 656E"            /*  in vigore a ben */
	$"6566 6963 696F 2064 656C 6C65 2070 6172"            /* eficio delle par */
	$"7469 2C20 6465 6920 6C6F 726F 2073 7563"            /* ti, dei loro suc */
	$"6365 7373 6F72 6920 6520 6465 676C 6920"            /* cessori e degli  */
	$"696E 6361 7269 6368 6920 636F 6E63 6573"            /* incarichi conces */
	$"7369 2E"                                            /* si. */
};

data 'styl' (5003, "Italian SLA") {
	$"0003 0000 0000 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 0168 000F 000C 0400"            /* .........h...... */
	$"0190 000C 0000 0000 0000 0000 01A1 000F"            /* .ê...........°.. */
	$"000C 0400 0090 000C 0000 0000 0000"                 /* .....ê........ */
};

data 'TEXT' (5004, "Spanish SLA") {
	$"4C61 2070 7265 7365 6E74 6520 6573 2075"            /* La presente es u */
	$"6E61 2074 7261 6475 6363 6997 6E20 6E6F"            /* na traducción no */
	$"206F 6669 6369 616C 2061 6C20 6573 7061"            /*  oficial al espa */
	$"966F 6C20 6465 6C20 4555 4C41 205B 456E"            /* ñol del EULA [En */
	$"6420 5573 6572 204C 6963 656E 7365 2041"            /* d User License A */
	$"6772 6565 6D65 6E74 2C20 436F 6E74 7261"            /* greement, Contra */
	$"746F 2064 6520 4C69 6365 6E63 6961 2064"            /* to de Licencia d */
	$"6520 5573 7561 7269 6F20 4669 6E61 6C5D"            /* e Usuario Final] */
	$"2064 6520 4341 4D49 4E4F 2E20 4E6F 2065"            /*  de CAMINO. No e */
	$"7374 6162 6C65 6365 206C 6567 616C 6D65"            /* stablece legalme */
	$"6E74 6520 6C6F 7320 748E 726D 696E 6F73"            /* nte los términos */
	$"2064 6520 6C61 206C 6963 656E 6369 6120"            /*  de la licencia  */
	$"7061 7261 2065 7374 6120 636F 7069 6120"            /* para esta copia  */
	$"6465 2043 414D 494E 4F20 D173 976C 6F20"            /* de CAMINO —sólo  */
	$"656C 2074 6578 746F 206F 7269 6769 6E61"            /* el texto origina */
	$"6C20 656E 2069 6E67 6C8E 7320 6465 6C20"            /* l en inglés del  */
	$"4555 4C41 2C20 7175 6520 7365 2069 6E63"            /* EULA, que se inc */
	$"6C75 7965 206D 8773 2061 6261 6A6F 2C20"            /* luye más abajo,  */
	$"6375 6D70 6C65 2074 616C 2070 726F 7097"            /* cumple tal propó */
	$"7369 746F 2E20 4E6F 206F 6273 7461 6E74"            /* sito. No obstant */
	$"6520 656C 6C6F 2C20 6573 7065 7261 6D6F"            /* e ello, esperamo */
	$"7320 7175 6520 6573 7461 2074 7261 6475"            /* s que esta tradu */
	$"6363 6997 6E20 6179 7564 6520 6120 6C6F"            /* cción ayude a lo */
	$"7320 6869 7370 616E 6F20 7061 726C 616E"            /* s hispano parlan */
	$"7465 7320 6120 636F 6D70 7265 6E64 6572"            /* tes a comprender */
	$"206D 656A 6F72 2065 6C20 4555 4C41 2064"            /*  mejor el EULA d */
	$"6520 4341 4D49 4E4F 2E0D 0D43 4F4E 5452"            /* e CAMINO...CONTR */
	$"4154 4F20 4445 204C 4943 454E 4349 4120"            /* ATO DE LICENCIA  */
	$"4445 2053 4F46 5457 4152 4520 4445 2055"            /* DE SOFTWARE DE U */
	$"5355 4152 494F 2046 494E 414C 2044 4520"            /* SUARIO FINAL DE  */
	$"4341 4D49 4E4F 0D56 6572 7369 976E 2031"            /* CAMINO.Versión 1 */
	$"2E31 0D0D 5449 454E 4520 4120 5355 2044"            /* .1..TIENE A SU D */
	$"4953 504F 5349 4349 EE4E 2055 4E41 2056"            /* ISPOSICIÓN UNA V */
	$"4552 5349 EE4E 2044 454C 2043 EE44 4947"            /* ERSIÓN DEL CÓDIG */
	$"4F20 4655 454E 5445 2044 4520 4349 4552"            /* O FUENTE DE CIER */
	$"5441 2046 554E 4349 4F4E 414C 4944 4144"            /* TA FUNCIONALIDAD */
	$"2044 454C 2042 5553 4341 444F 5220 4341"            /*  DEL BUSCADOR CA */
	$"4D49 4E4F 2C20 5155 4520 5055 4544 4520"            /* MINO, QUE PUEDE  */
	$"5553 4152 2C20 4D4F 4449 4649 4341 5220"            /* USAR, MODIFICAR  */
	$"5920 4449 5354 5249 4255 4952 2C20 5349"            /* Y DISTRIBUIR, SI */
	$"4E20 4341 5247 4F20 414C 4755 4E4F 2050"            /* N CARGO ALGUNO P */
	$"4152 4120 5553 5445 442C 2045 4E20 5757"            /* ARA USTED, EN WW */
	$"572E 4D4F 5A49 4C4C 412E 4F52 472C 2042"            /* W.MOZILLA.ORG, B */
	$"414A 4F20 4C41 204C 4943 454E 4349 4120"            /* AJO LA LICENCIA  */
	$"50F2 424C 4943 4120 4445 204D 4F5A 494C"            /* PÚBLICA DE MOZIL */
	$"4C41 2079 206F 7472 6173 206C 6963 656E"            /* LA y otras licen */
	$"6369 6173 2064 6520 736F 6674 7761 7265"            /* cias de software */
	$"2064 6520 6675 656E 7465 2061 6269 6572"            /*  de fuente abier */
	$"7461 2E0D 0D4C 6120 7665 7273 6997 6E20"            /* ta...La versión  */
	$"6465 2063 9764 6967 6F20 656A 6563 7574"            /* de código ejecut */
	$"6162 6C65 2061 646A 756E 7461 2064 6520"            /* able adjunta de  */
	$"4341 4D49 4E4F 2079 206C 6120 646F 6375"            /* CAMINO y la docu */
	$"6D65 6E74 6163 6997 6E20 7265 6C61 6369"            /* mentación relaci */
	$"6F6E 6164 6120 2865 6C20 2250 726F 6475"            /* onada (el "Produ */
	$"6374 6F22 2920 6573 7487 6E20 6120 7375"            /* cto") están a su */
	$"2064 6973 706F 7369 6369 976E 2C20 6465"            /*  disposición, de */
	$"2063 6F6E 666F 726D 6964 6164 2063 6F6E"            /*  conformidad con */
	$"206C 6F73 2074 8E72 6D69 6E6F 7320 6465"            /*  los términos de */
	$"6C20 7072 6573 656E 7465 2043 4F4E 5452"            /* l presente CONTR */
	$"4154 4F20 4445 204C 4943 454E 4349 4120"            /* ATO DE LICENCIA  */
	$"4445 2053 4F46 5457 4152 4520 4445 2055"            /* DE SOFTWARE DE U */
	$"5355 4152 494F 2046 494E 414C 2044 4520"            /* SUARIO FINAL DE  */
	$"4341 4D49 4E4F 2028 454C 2022 434F 4E54"            /* CAMINO (EL "CONT */
	$"5241 544F 2229 2E20 414C 2048 4143 4552"            /* RATO"). AL HACER */
	$"2043 4C49 4320 454E 2045 4C20 424F 54EE"            /*  CLIC EN EL BOTÓ */
	$"4E20 2241 4345 5054 4152 2220 4F20 414C"            /* N "ACEPTAR" O AL */
	$"2049 4E53 5441 4C41 5220 4F20 5553 4152"            /*  INSTALAR O USAR */
	$"2045 4C20 4255 5343 4144 4F52 2043 414D"            /*  EL BUSCADOR CAM */
	$"494E 4F2C 2055 5354 4544 2041 4345 5054"            /* INO, USTED ACEPT */
	$"4120 4C41 5320 4F42 4C49 4741 4349 4F4E"            /* A LAS OBLIGACION */
	$"4553 2049 4E48 4552 454E 5445 5320 414C"            /* ES INHERENTES AL */
	$"2043 4F4E 5452 4154 4F2E 2053 4920 4E4F"            /*  CONTRATO. SI NO */
	$"2045 5354 5556 4945 5241 2044 4520 4143"            /*  ESTUVIERA DE AC */
	$"5545 5244 4F20 434F 4E20 4C4F 5320 5483"            /* UERDO CON LOS TÉ */
	$"524D 494E 4F53 2059 2043 4F4E 4449 4349"            /* RMINOS Y CONDICI */
	$"4F4E 4553 2044 454C 204D 4953 4D4F 2C20"            /* ONES DEL MISMO,  */
	$"4E4F 2048 4147 4120 434C 4943 2045 4E20"            /* NO HAGA CLIC EN  */
	$"454C 2042 4F54 EE4E 2022 4143 4550 5441"            /* EL BOTÓN "ACEPTA */
	$"5222 2059 204E 4F20 494E 5354 414C 4520"            /* R" Y NO INSTALE  */
	$"4E49 2055 5345 204E 494E 4755 4E41 2050"            /* NI USE NINGUNA P */
	$"4152 5445 2044 454C 2042 5553 4341 444F"            /* ARTE DEL BUSCADO */
	$"5220 4341 4D49 4E4F 2E20 4455 5241 4E54"            /* R CAMINO. DURANT */
	$"4520 454C 2050 524F 4345 534F 2044 4520"            /* E EL PROCESO DE  */
	$"494E 5354 414C 4143 49EE 4E20 4445 2043"            /* INSTALACIÓN DE C */
	$"414D 494E 4F20 5920 454E 2045 4C20 4655"            /* AMINO Y EN EL FU */
	$"5455 524F 2C20 4349 4552 544F 5320 5052"            /* TURO, CIERTOS PR */
	$"4F56 4545 444F 5245 5320 4445 2053 4F46"            /* OVEEDORES DE SOF */
	$"5457 4152 4520 494E 4445 5045 4E44 4945"            /* TWARE INDEPENDIE */
	$"4E54 4553 2050 5545 4445 4E20 4252 494E"            /* NTES PUEDEN BRIN */
	$"4441 524C 4520 4C41 204F 5043 49EE 4E20"            /* DARLE LA OPCIÓN  */
	$"4445 2049 4E53 5441 4C41 5220 434F 4D50"            /* DE INSTALAR COMP */
	$"4F4E 454E 5445 5320 4144 4943 494F 4E41"            /* ONENTES ADICIONA */
	$"4C45 532E 204C 4120 494E 5354 414C 4143"            /* LES. LA INSTALAC */
	$"49EE 4E20 5920 454C 2055 534F 2044 4520"            /* IÓN Y EL USO DE  */
	$"4553 4F53 2043 4F4D 504F 4E45 4E54 4553"            /* ESOS COMPONENTES */
	$"2044 4520 5445 5243 4552 4F53 2050 5545"            /*  DE TERCEROS PUE */
	$"4445 4E20 5245 4749 5253 4520 504F 5220"            /* DEN REGIRSE POR  */
	$"4F54 524F 5320 434F 4E54 5241 544F 5320"            /* OTROS CONTRATOS  */
	$"4445 204C 4943 454E 4349 412E 0D0D 312E"            /* DE LICENCIA...1. */
	$"2043 4F4E 4345 5349 EE4E 2044 4520 4C41"            /*  CONCESIÓN DE LA */
	$"204C 4943 454E 4349 412E 2054 6865 204D"            /*  LICENCIA. The M */
	$"6F7A 696C 6C61 2046 6F75 6E64 6174 696F"            /* ozilla Foundatio */
	$"6E20 6C65 206F 746F 7267 6120 756E 6120"            /* n le otorga una  */
	$"6C69 6365 6E63 6961 206E 6F20 6578 636C"            /* licencia no excl */
	$"7573 6976 6120 7061 7261 2075 7361 7220"            /* usiva para usar  */
	$"6C61 2076 6572 7369 976E 2063 6F6E 2063"            /* la versión con c */
	$"9764 6967 6F20 656A 6563 7574 6162 6C65"            /* ódigo ejecutable */
	$"2064 656C 2050 726F 6475 6374 6F2E 2045"            /*  del Producto. E */
	$"6C20 7072 6573 656E 7465 2043 6F6E 7472"            /* l presente Contr */
	$"6174 6F20 7461 6D62 698E 6E20 7265 6769"            /* ato también regi */
	$"7287 2073 6F62 7265 2063 7561 6C71 7569"            /* rá sobre cualqui */
	$"6572 6120 6465 206C 6173 2061 6374 7561"            /* era de las actua */
	$"6C69 7A61 6369 6F6E 6573 2064 6520 736F"            /* lizaciones de so */
	$"6674 7761 7265 2070 726F 7669 7374 6173"            /* ftware provistas */
	$"2070 6F72 204D 6F7A 696C 6C61 2071 7565"            /*  por Mozilla que */
	$"2072 6565 6D70 6C61 6365 6E20 792F 6F20"            /*  reemplacen y/o  */
	$"636F 6D70 6C65 6D65 6E74 656E 2061 6C20"            /* complementen al  */
	$"5072 6F64 7563 746F 206F 7269 6769 6E61"            /* Producto origina */
	$"6C2C 2061 206D 656E 6F73 2071 7565 2064"            /* l, a menos que d */
	$"6963 6861 7320 6163 7475 616C 697A 6163"            /* ichas actualizac */
	$"696F 6E65 7320 6573 748E 6E20 6163 6F6D"            /* iones estén acom */
	$"7061 9661 6461 7320 6465 2075 6E61 206C"            /* pañadas de una l */
	$"6963 656E 6369 6120 7365 7061 7261 6461"            /* icencia separada */
	$"2C20 656E 2063 7579 6F20 6361 736F 2070"            /* , en cuyo caso p */
	$"7265 7661 6C65 6365 7287 6E20 6C6F 7320"            /* revalecerán los  */
	$"748E 726D 696E 6F73 2064 6520 6573 6120"            /* términos de esa  */
	$"6C69 6365 6E63 6961 2E0D 0D32 2E20 4558"            /* licencia...2. EX */
	$"5449 4E43 49EE 4E20 4445 4C20 434F 4E54"            /* TINCIÓN DEL CONT */
	$"5241 544F 2E20 5369 2075 7374 6564 2063"            /* RATO. Si usted c */
	$"6F6D 6574 6520 756E 6120 7669 6F6C 6163"            /* omete una violac */
	$"6997 6E20 636F 6E74 7261 6374 7561 6C2C"            /* ión contractual, */
	$"2073 7520 6465 7265 6368 6F20 6120 7573"            /*  su derecho a us */
	$"6172 2065 6C20 5072 6F64 7563 746F 2063"            /* ar el Producto c */
	$"6573 6172 8720 6465 2069 6E6D 6564 6961"            /* esará de inmedia */
	$"746F 2079 2073 696E 206E 6F74 6966 6963"            /* to y sin notific */
	$"6163 6997 6E20 7072 6576 6961 2C20 6175"            /* ación previa, au */
	$"6E71 7565 2074 6F64 6173 206C 6173 2064"            /* nque todas las d */
	$"6973 706F 7369 6369 6F6E 6573 2064 656C"            /* isposiciones del */
	$"206D 6973 6D6F 20D1 636F 6E20 6578 6365"            /*  mismo —con exce */
	$"7063 6997 6E20 6465 206C 6120 636F 6E63"            /* pción de la conc */
	$"6573 6997 6E20 6465 206C 6963 656E 6369"            /* esión de licenci */
	$"6120 2870 8772 7261 666F 2031 29D1 2073"            /* a (párrafo 1)— s */
	$"7562 7369 7374 6972 876E 2061 2064 6963"            /* ubsistirán a dic */
	$"6861 2065 7874 696E 6369 976E 2079 2063"            /* ha extinción y c */
	$"6F6E 7365 7276 6172 876E 2073 7520 7661"            /* onservarán su va */
	$"6C69 6465 7A2E 2041 6E74 6520 6C61 2065"            /* lidez. Ante la e */
	$"7874 696E 6369 976E 2063 6F6E 7472 6163"            /* xtinción contrac */
	$"7475 616C 2C20 7573 7465 6420 6465 6265"            /* tual, usted debe */
	$"2064 6573 7472 7569 7220 746F 6461 7320"            /*  destruir todas  */
	$"6C61 7320 636F 7069 6173 2064 656C 2050"            /* las copias del P */
	$"726F 6475 6374 6F2E 0D0D 332E 2044 4552"            /* roducto...3. DER */
	$"4543 484F 5320 4445 2050 524F 5049 4544"            /* ECHOS DE PROPIED */
	$"4144 2E20 4861 7920 7061 7274 6573 2064"            /* AD. Hay partes d */
	$"6973 706F 6E69 626C 6573 2064 656C 2050"            /* isponibles del P */
	$"726F 6475 6374 6F20 656E 2066 6F72 6D61"            /* roducto en forma */
	$"2064 6520 6397 6469 676F 2066 7565 6E74"            /*  de código fuent */
	$"652C 2073 6567 9C6E 206C 6F73 2074 8E72"            /* e, según los tér */
	$"6D69 6E6F 7320 6465 206C 6120 4C69 6365"            /* minos de la Lice */
	$"6E63 6961 2070 9C62 6C69 6361 2064 6520"            /* ncia pública de  */
	$"4D6F 7A69 6C6C 6120 7920 6F74 7261 7320"            /* Mozilla y otras  */
	$"6C69 6365 6E63 6961 7320 6465 2066 7565"            /* licencias de fue */
	$"6E74 6520 6162 6965 7274 6120 2864 656E"            /* nte abierta (den */
	$"6F6D 696E 6164 6173 2065 6E20 666F 726D"            /* ominadas en form */
	$"6120 636F 6C65 6374 6976 612C 2022 4C69"            /* a colectiva, "Li */
	$"6365 6E63 6961 7320 6465 2066 7565 6E74"            /* cencias de fuent */
	$"6520 6162 6965 7274 6122 2920 656E 206C"            /* e abierta") en l */
	$"6120 7369 6775 6965 6E74 6520 6469 7265"            /* a siguiente dire */
	$"6363 6997 6E3A 2068 7474 703A 2F2F 7777"            /* cción: http://ww */
	$"772E 6D6F 7A69 6C6C 612E 6F72 672E 204E"            /* w.mozilla.org. N */
	$"696E 6775 6E6F 2064 6520 6C6F 7320 636F"            /* inguno de los co */
	$"6E74 656E 6964 6F73 2064 656C 2070 7265"            /* ntenidos del pre */
	$"7365 6E74 6520 436F 6E74 7261 746F 2068"            /* sente Contrato h */
	$"6162 7287 2064 6520 696E 7465 7270 7265"            /* abrá de interpre */
	$"7461 7273 6520 636F 6D6F 2075 6E61 206C"            /* tarse como una l */
	$"696D 6974 6163 6997 6E20 6120 6E69 6E67"            /* imitación a ning */
	$"756E 6F20 6465 206C 6F73 2064 6572 6563"            /* uno de los derec */
	$"686F 7320 6F74 6F72 6761 646F 7320 656E"            /* hos otorgados en */
	$"2076 6972 7475 6420 6465 206C 6173 204C"            /*  virtud de las L */
	$"6963 656E 6369 6173 2064 6520 6675 656E"            /* icencias de fuen */
	$"7465 2061 6269 6572 7461 2E20 436F 6E20"            /* te abierta. Con  */
	$"7375 6A65 6369 976E 2061 2063 7561 6E74"            /* sujeción a cuant */
	$"6F20 7072 6563 6564 652C 204D 6F7A 696C"            /* o precede, Mozil */
	$"6C61 2C20 656E 206E 6F6D 6272 6520 7072"            /* la, en nombre pr */
	$"6F70 696F 2079 2072 6570 7265 7365 6E74"            /* opio y represent */
	$"6163 6997 6E20 6465 2073 7573 2063 6F6E"            /* ación de sus con */
	$"6365 6465 6E74 6573 2064 6520 6C69 6365"            /* cedentes de lice */
	$"6E63 6961 2C20 7365 2072 6573 6572 7661"            /* ncia, se reserva */
	$"2070 6F72 2065 7374 6520 6D65 6469 6F20"            /*  por este medio  */
	$"746F 646F 7320 6C6F 7320 6465 7265 6368"            /* todos los derech */
	$"6F73 2064 6520 7072 6F70 6965 6461 6420"            /* os de propiedad  */
	$"696E 7465 6C65 6374 7561 6C20 656E 2065"            /* intelectual en e */
	$"6C20 5072 6F64 7563 746F 2C20 636F 6E20"            /* l Producto, con  */
	$"6578 6365 7063 6997 6E20 6465 206C 6F73"            /* excepción de los */
	$"2064 6572 6563 686F 7320 6578 7072 6573"            /*  derechos expres */
	$"616D 656E 7465 206F 746F 7267 6164 6F73"            /* amente otorgados */
	$"2065 6E20 656C 2070 7265 7365 6E74 6520"            /*  en el presente  */
	$"436F 6E74 7261 746F 2E20 5573 7465 6420"            /* Contrato. Usted  */
	$"6E6F 2070 7565 6465 2065 6C69 6D69 6E61"            /* no puede elimina */
	$"7220 6E69 2061 6C74 6572 6172 206E 696E"            /* r ni alterar nin */
	$"6775 6E61 206D 6172 6361 2C20 6C6F 676F"            /* guna marca, logo */
	$"7469 706F 2C20 6176 6973 6F20 6465 20D2"            /* tipo, aviso de “ */
	$"636F 7079 7269 6768 74D3 205B 6465 7265"            /* copyright” [dere */
	$"6368 6F73 2064 6520 6175 746F 725D 206F"            /* chos de autor] o */
	$"206E 696E 679C 6E20 6F74 726F 2061 7669"            /*  ningún otro avi */
	$"736F 2064 6520 7072 6F70 6965 6461 6420"            /* so de propiedad  */
	$"7175 6520 7365 2065 6E63 7565 6E74 7265"            /* que se encuentre */
	$"2065 6E20 6F20 736F 6272 6520 656C 2050"            /*  en o sobre el P */
	$"726F 6475 6374 6F2E 204C 6120 6C69 6365"            /* roducto. La lice */
	$"6E63 6961 206E 6F20 6C65 206F 746F 7267"            /* ncia no le otorg */
	$"6120 6E69 6E67 9C6E 2064 6572 6563 686F"            /* a ningún derecho */
	$"2064 6520 7573 6F20 6465 206D 6172 6361"            /*  de uso de marca */
	$"732C 206D 6172 6361 7320 6465 2073 6572"            /* s, marcas de ser */
	$"7669 6369 6F20 6F20 6C6F 676F 7469 706F"            /* vicio o logotipo */
	$"7320 6465 204D 6F7A 696C 6C61 206F 2073"            /* s de Mozilla o s */
	$"7573 2063 6F6E 6365 6465 6E74 6573 2064"            /* us concedentes d */
	$"6520 6C69 6365 6E63 6961 2E0D 0D34 2E20"            /* e licencia...4.  */
	$"4445 4E45 4741 4349 EE4E 2044 4520 4741"            /* DENEGACIÓN DE GA */
	$"5241 4E54 EA41 2E20 454C 2050 524F 4455"            /* RANTÍA. EL PRODU */
	$"4354 4F20 5345 2050 524F 5645 4520 2245"            /* CTO SE PROVEE "E */
	$"4E20 454C 2045 5354 4144 4F20 454E 2051"            /* N EL ESTADO EN Q */
	$"5545 2053 4520 454E 4355 454E 5452 4122"            /* UE SE ENCUENTRA" */
	$"2C20 434F 4E20 544F 444F 5320 5355 5320"            /* , CON TODOS SUS  */
	$"4445 4645 4354 4F53 2E20 454E 204C 4120"            /* DEFECTOS. EN LA  */
	$"4D45 4449 4441 2044 4520 4C4F 2050 4552"            /* MEDIDA DE LO PER */
	$"4D49 5449 444F 2050 4F52 204C 4120 4C45"            /* MITIDO POR LA LE */
	$"592C 204D 4F5A 494C 4C41 2C20 4C4F 5320"            /* Y, MOZILLA, LOS  */
	$"4449 5354 5249 4255 4944 4F52 4553 2044"            /* DISTRIBUIDORES D */
	$"4520 4D4F 5A49 4C4C 4120 5920 5355 5320"            /* E MOZILLA Y SUS  */
	$"434F 4E43 4544 454E 5445 5320 4445 204C"            /* CONCEDENTES DE L */
	$"4943 454E 4349 4120 4445 4E49 4547 414E"            /* ICENCIA DENIEGAN */
	$"2050 4F52 2045 5354 4520 4D45 4449 4F20"            /*  POR ESTE MEDIO  */
	$"544F 444F 2054 4950 4F20 4445 2047 4152"            /* TODO TIPO DE GAR */
	$"414E 54EA 4153 2C20 5941 2053 4541 4E20"            /* ANTÍAS, YA SEAN  */
	$"4558 5052 4553 4153 204F 2054 E743 4954"            /* EXPRESAS O TÁCIT */
	$"4153 2C20 4C4F 2043 5541 4C20 494E 434C"            /* AS, LO CUAL INCL */
	$"5559 452C 2053 494E 204C 494D 4954 4143"            /* UYE, SIN LIMITAC */
	$"494F 4E45 532C 204C 4153 2047 4152 414E"            /* IONES, LAS GARAN */
	$"54EA 4153 2051 5545 2043 4F4E 4649 524D"            /* TÍAS QUE CONFIRM */
	$"414E 2051 5545 2045 4C20 5052 4F44 5543"            /* AN QUE EL PRODUC */
	$"544F 2045 5354 E720 4C49 4252 4520 4445"            /* TO ESTÁ LIBRE DE */
	$"2044 4546 4543 544F 532C 2051 5545 2045"            /*  DEFECTOS, QUE E */
	$"5320 4E45 474F 4349 4142 4C45 2C20 4150"            /* S NEGOCIABLE, AP */
	$"544F 2050 4152 4120 554E 2050 524F 50EE"            /* TO PARA UN PROPÓ */
	$"5349 544F 2045 4E20 5041 5254 4943 554C"            /* SITO EN PARTICUL */
	$"4152 2059 2051 5545 204E 4F20 5649 4F4C"            /* AR Y QUE NO VIOL */
	$"4120 4C4F 5320 4445 5245 4348 4F53 2044"            /* A LOS DERECHOS D */
	$"4520 4155 544F 522E 2055 5354 4544 2041"            /* E AUTOR. USTED A */
	$"5355 4D49 52E7 204C 4120 5245 5350 4F4E"            /* SUMIRÁ LA RESPON */
	$"5341 4249 4C49 4441 4420 504F 5220 544F"            /* SABILIDAD POR TO */
	$"444F 2045 4C20 5249 4553 474F 2051 5545"            /* DO EL RIESGO QUE */
	$"2049 4D50 4C49 5155 4520 5345 4C45 4343"            /*  IMPLIQUE SELECC */
	$"494F 4E41 5220 454C 2050 524F 4455 4354"            /* IONAR EL PRODUCT */
	$"4F20 5041 5241 2053 5553 2050 524F 5049"            /* O PARA SUS PROPI */
	$"4F53 2046 494E 4553 2059 2054 414D 4249"            /* OS FINES Y TAMBI */
	$"834E 2045 4E20 4355 414E 544F 2041 204C"            /* ÉN EN CUANTO A L */
	$"4120 4341 4C49 4441 4420 5920 454C 2052"            /* A CALIDAD Y EL R */
	$"454E 4449 4D49 454E 544F 2044 454C 204D"            /* ENDIMIENTO DEL M */
	$"4953 4D4F 2E20 4553 5441 204C 494D 4954"            /* ISMO. ESTA LIMIT */
	$"4143 49EE 4E20 5345 2041 504C 4943 4152"            /* ACIÓN SE APLICAR */
	$"E720 494E 4445 5045 4E44 4945 4E54 454D"            /* Á INDEPENDIENTEM */
	$"454E 5445 2044 454C 2048 4543 484F 2044"            /* ENTE DEL HECHO D */
	$"4520 4E4F 2043 554D 504C 4952 2043 4F4E"            /* E NO CUMPLIR CON */
	$"2045 4C20 5052 4F50 EE53 4954 4F20 4553"            /*  EL PROPÓSITO ES */
	$"454E 4349 414C 2044 4520 544F 4441 2053"            /* ENCIAL DE TODA S */
	$"4F4C 5543 49EE 4E20 4A55 52EA 4449 4341"            /* OLUCIÓN JURÍDICA */
	$"2E20 414C 4755 4E41 5320 4A55 5249 5344"            /* . ALGUNAS JURISD */
	$"4943 4349 4F4E 4553 204E 4F20 5045 524D"            /* ICCIONES NO PERM */
	$"4954 454E 204C 4120 4558 434C 5553 49EE"            /* ITEN LA EXCLUSIÓ */
	$"4E20 4F20 4C49 4D49 5441 4349 EE4E 2044"            /* N O LIMITACIÓN D */
	$"4520 4C41 5320 4741 5241 4E54 EA41 5320"            /* E LAS GARANTÍAS  */
	$"54E7 4349 5441 532C 2044 4520 4D4F 444F"            /* TÁCITAS, DE MODO */
	$"2051 5545 2045 5354 4120 4445 4E45 4741"            /*  QUE ESTA DENEGA */
	$"4349 EE4E 2044 4520 4741 5241 4E54 EA41"            /* CIÓN DE GARANTÍA */
	$"5320 5055 4544 4520 4E4F 2041 504C 4943"            /* S PUEDE NO APLIC */
	$"4152 5345 2041 2053 5520 4341 534F 2E0D"            /* ARSE A SU CASO.. */
	$"0D35 2E20 4C49 4D49 5441 4349 EE4E 2044"            /* .5. LIMITACIÓN D */
	$"4520 5245 5350 4F4E 5341 4249 4C49 4441"            /* E RESPONSABILIDA */
	$"442E 2045 5843 4550 544F 2045 4E20 4C41"            /* D. EXCEPTO EN LA */
	$"204D 4544 4944 4120 5155 4520 4C41 204C"            /*  MEDIDA QUE LA L */
	$"4559 204C 4F20 4558 494A 412C 204D 4F5A"            /* EY LO EXIJA, MOZ */
	$"494C 4C41 2059 2053 5553 2044 4953 5452"            /* ILLA Y SUS DISTR */
	$"4942 5549 444F 5245 532C 2044 4952 4543"            /* IBUIDORES, DIREC */
	$"544F 5245 532C 2043 4F4E 4345 4445 4E54"            /* TORES, CONCEDENT */
	$"4553 2044 4520 4C49 4345 4E43 4941 2C20"            /* ES DE LICENCIA,  */
	$"434F 4E54 5249 4255 5945 4E54 4553 2059"            /* CONTRIBUYENTES Y */
	$"2041 504F 4445 5241 444F 5320 2844 454E"            /*  APODERADOS (DEN */
	$"4F4D 494E 4144 4F53 2045 4E20 464F 524D"            /* OMINADOS EN FORM */
	$"4120 434F 4C45 4354 4956 412C 2045 4C20"            /* A COLECTIVA, EL  */
	$"2247 5255 504F 204D 4F5A 494C 4C41 2229"            /* "GRUPO MOZILLA") */
	$"204E 4F20 4153 554D 4952 E74E 2052 4553"            /*  NO ASUMIRÁN RES */
	$"504F 4E53 4142 494C 4944 4144 2041 4C47"            /* PONSABILIDAD ALG */
	$"554E 4120 504F 5220 4E49 4E47 F24E 2044"            /* UNA POR NINGÚN D */
	$"4184 4F20 494E 4449 5245 4354 4F2C 2045"            /* AÑO INDIRECTO, E */
	$"5350 4543 4941 4C2C 2049 4E43 4944 454E"            /* SPECIAL, INCIDEN */
	$"5441 4C2C 2043 4F4E 5345 4355 454E 5445"            /* TAL, CONSECUENTE */
	$"204F 2045 4A45 4D50 4C41 5220 5155 4520"            /*  O EJEMPLAR QUE  */
	$"5355 524A 4120 4445 2045 5354 4520 434F"            /* SURJA DE ESTE CO */
	$"4E54 5241 544F 2C20 4F20 5155 4520 5345"            /* NTRATO, O QUE SE */
	$"2052 454C 4143 494F 4E45 2044 4520 414C"            /*  RELACIONE DE AL */
	$"47F2 4E20 4D4F 444F 2043 4F4E 2083 4C2C"            /* GÚN MODO CON ÉL, */
	$"204F 2045 4C20 5553 4F20 4445 4C20 5052"            /*  O EL USO DEL PR */
	$"4F44 5543 544F 204F 204C 4120 494E 4341"            /* ODUCTO O LA INCA */
	$"5041 4349 4441 4420 4445 2055 5341 524C"            /* PACIDAD DE USARL */
	$"4F2C 204C 4F20 4355 414C 2049 4E43 4C55"            /* O, LO CUAL INCLU */
	$"5945 2053 494E 204C 494D 4954 4143 49EE"            /* YE SIN LIMITACIÓ */
	$"4E20 4C4F 5320 4441 844F 5320 504F 5220"            /* N LOS DAÑOS POR  */
	$"5083 5244 4944 4120 4445 2050 5245 5354"            /* PÉRDIDA DE PREST */
	$"4947 494F 2043 4F4D 4552 4349 414C 2C20"            /* IGIO COMERCIAL,  */
	$"5041 5241 4C49 5A41 4349 EE4E 2044 4520"            /* PARALIZACIÓN DE  */
	$"5452 4142 414A 4F2C 204C 5543 524F 2043"            /* TRABAJO, LUCRO C */
	$"4553 414E 5445 2C20 5083 5244 4944 4120"            /* ESANTE, PÉRDIDA  */
	$"4445 2044 4154 4F53 2059 2046 414C 4C4F"            /* DE DATOS Y FALLO */
	$"204F 204D 414C 2046 554E 4349 4F4E 414D"            /*  O MAL FUNCIONAM */
	$"4945 4E54 4F20 494E 464F 524D E754 4943"            /* IENTO INFORMÁTIC */
	$"4F2C 2041 554E 2043 5541 4E44 4F20 4655"            /* O, AUN CUANDO FU */
	$"4552 4120 4144 5645 5254 4944 4F20 4445"            /* ERA ADVERTIDO DE */
	$"204C 4120 504F 5349 4249 4C49 4441 4420"            /*  LA POSIBILIDAD  */
	$"4445 2044 4943 484F 5320 4441 844F 5320"            /* DE DICHOS DAÑOS  */
	$"4520 494E 4445 5045 4E44 4945 4E54 454D"            /* E INDEPENDIENTEM */
	$"454E 5445 2044 4520 4C41 2048 4950 EE54"            /* ENTE DE LA HIPÓT */
	$"4553 4953 2028 434F 4E54 5241 544F 2C20"            /* ESIS (CONTRATO,  */
	$"4143 544F 2049 4CEA 4349 544F 2043 4956"            /* ACTO ILÍCITO CIV */
	$"494C 2055 204F 5452 4F53 2920 534F 4252"            /* IL U OTROS) SOBR */
	$"4520 4C41 2051 5545 2053 4520 4241 5345"            /* E LA QUE SE BASE */
	$"2044 4943 484F 2052 4543 4C41 4D4F 2E20"            /*  DICHO RECLAMO.  */
	$"4C41 2052 4553 504F 4E53 4142 494C 4944"            /* LA RESPONSABILID */
	$"4144 2043 4F4C 4543 5449 5641 2044 454C"            /* AD COLECTIVA DEL */
	$"2047 5255 504F 204D 4F5A 494C 4C41 2045"            /*  GRUPO MOZILLA E */
	$"4E20 5649 5254 5544 2044 454C 2050 5245"            /* N VIRTUD DEL PRE */
	$"5345 4E54 4520 434F 4E54 5241 544F 204E"            /* SENTE CONTRATO N */
	$"4F20 5355 5045 5241 52E7 204C 4F53 2024"            /* O SUPERARÁ LOS $ */
	$"3530 3020 2851 5549 4E49 454E 544F 5320"            /* 500 (QUINIENTOS  */
	$"44EE 4C41 5245 5320 4553 5441 444F 554E"            /* DÓLARES ESTADOUN */
	$"4944 454E 5345 5329 2059 204C 4F53 2044"            /* IDENSES) Y LOS D */
	$"4552 4543 484F 5320 4445 204C 4943 454E"            /* ERECHOS DE LICEN */
	$"4349 4120 5155 4520 5553 5445 4420 4855"            /* CIA QUE USTED HU */
	$"4249 4552 4120 5041 4741 444F 2045 4E20"            /* BIERA PAGADO EN  */
	$"5649 5254 5544 2044 4520 4553 5441 204C"            /* VIRTUD DE ESTA L */
	$"4943 454E 4349 4120 2853 4920 5355 2048"            /* ICENCIA (SI SU H */
	$"5542 4945 5241 2050 4147 4144 4F20 414C"            /* UBIERA PAGADO AL */
	$"4755 4E4F 292C 2045 4C20 494D 504F 5254"            /* GUNO), EL IMPORT */
	$"4520 5155 4520 4655 4552 4120 4D41 594F"            /* E QUE FUERA MAYO */
	$"522E 2041 4C47 554E 4153 204A 5552 4953"            /* R. ALGUNAS JURIS */
	$"4449 4343 494F 4E45 5320 4E4F 2050 4552"            /* DICCIONES NO PER */
	$"4D49 5445 4E20 4C41 2045 5843 4C55 5349"            /* MITEN LA EXCLUSI */
	$"EE4E 204F 204C 494D 4954 4143 49EE 4E20"            /* ÓN O LIMITACIÓN  */
	$"4445 204C 4F53 2044 4184 4F53 2049 4E43"            /* DE LOS DAÑOS INC */
	$"4944 454E 5441 4C45 532C 2043 4F4E 5345"            /* IDENTALES, CONSE */
	$"4355 454E 5445 5320 4F20 4553 5045 4349"            /* CUENTES O ESPECI */
	$"414C 4553 2C20 4445 204D 4F44 4F20 5155"            /* ALES, DE MODO QU */
	$"4520 4553 5441 2045 5843 4C55 5349 EE4E"            /* E ESTA EXCLUSIÓN */
	$"2059 204C 494D 4954 4143 49EE 4E20 5055"            /*  Y LIMITACIÓN PU */
	$"4544 4520 4E4F 2041 504C 4943 4152 5345"            /* EDE NO APLICARSE */
	$"2045 4E20 5355 2043 4153 4F2E 0D0D 362E"            /*  EN SU CASO...6. */
	$"2043 4F4E 5452 4F4C 4553 2044 4520 4558"            /*  CONTROLES DE EX */
	$"504F 5254 4143 49EE 4E2E 2045 7374 6120"            /* PORTACIÓN. Esta  */
	$"6C69 6365 6E63 6961 2065 7374 8720 7375"            /* licencia está su */
	$"6A65 7461 2061 2074 6F64 6173 206C 6173"            /* jeta a todas las */
	$"2072 6573 7472 6963 6369 6F6E 6573 2064"            /*  restricciones d */
	$"6520 6578 706F 7274 6163 6997 6E20 6170"            /* e exportación ap */
	$"6C69 6361 626C 6573 2E20 5573 7465 6420"            /* licables. Usted  */
	$"6465 6265 2063 756D 706C 6972 2063 6F6E"            /* debe cumplir con */
	$"2074 6F64 6173 206C 6173 206C 6579 6573"            /*  todas las leyes */
	$"2079 2072 6573 7472 6963 6369 6F6E 6573"            /*  y restricciones */
	$"2064 6520 6578 706F 7274 6163 6997 6E20"            /*  de exportación  */
	$"6520 696D 706F 7274 6163 6997 6E20 7920"            /* e importación y  */
	$"636F 6E20 6C61 7320 7265 6775 6C61 6369"            /* con las regulaci */
	$"6F6E 6573 2064 6520 6375 616C 7175 6965"            /* ones de cualquie */
	$"7220 7265 7061 7274 6963 6997 6E20 6F20"            /* r repartición o  */
	$"6175 746F 7269 6461 6420 6465 206C 6F73"            /* autoridad de los */
	$"2045 7374 6164 6F73 2055 6E69 646F 7320"            /*  Estados Unidos  */
	$"6F20 6578 7472 616E 6A65 7261 2071 7565"            /* o extranjera que */
	$"2073 6520 7265 6C61 6369 6F6E 6520 636F"            /*  se relacione co */
	$"6E20 656C 2050 726F 6475 6374 6F20 7920"            /* n el Producto y  */
	$"7375 2075 736F 2E0D 0D37 2E20 5553 5541"            /* su uso...7. USUA */
	$"5249 4F53 2046 494E 414C 4553 2044 454C"            /* RIOS FINALES DEL */
	$"2047 4F42 4945 524E 4F20 4445 204C 4F53"            /*  GOBIERNO DE LOS */
	$"2045 5354 4144 4F53 2055 4E49 444F 532E"            /*  ESTADOS UNIDOS. */
	$"2045 6C20 5072 6F64 7563 746F 2065 7320"            /*  El Producto es  */
	$"756E 2022 6172 7492 6375 6C6F 2063 6F6D"            /* un "artículo com */
	$"6572 6369 616C 222C 2074 8E72 6D69 6E6F"            /* ercial", término */
	$"2071 7565 2073 6520 6465 6669 6E65 2065"            /*  que se define e */
	$"6E20 656C 2054 9274 756C 6F20 3438 2064"            /* n el Título 48 d */
	$"656C 2043 9764 6967 6F20 6465 2052 6567"            /* el Código de Reg */
	$"6C61 6D65 6E74 6F73 2046 6564 6572 616C"            /* lamentos Federal */
	$"6573 2C20 656E 2073 7520 4172 7492 6375"            /* es, en su Artícu */
	$"6C6F 2032 2E31 3031 2C20 656C 2063 7561"            /* lo 2.101, el cua */
	$"6C20 636F 6E73 6973 7465 2065 6E20 2273"            /* l consiste en "s */
	$"6F66 7477 6172 6520 6465 2063 6F6D 7075"            /* oftware de compu */
	$"7461 646F 7261 7320 636F 6D65 7263 6961"            /* tadoras comercia */
	$"6C22 2079 2022 646F 6375 6D65 6E74 6163"            /* l" y "documentac */
	$"6997 6E20 6465 2073 6F66 7477 6172 6520"            /* ión de software  */
	$"6465 2063 6F6D 7075 7461 646F 7261 7320"            /* de computadoras  */
	$"636F 6D65 7263 6961 6C22 2C20 748E 726D"            /* comercial", térm */
	$"696E 6F73 2071 7565 2073 6520 7574 696C"            /* inos que se util */
	$"697A 616E 2065 6E20 656C 2054 9274 756C"            /* izan en el Títul */
	$"6F20 3438 2064 656C 2043 9764 6967 6F20"            /* o 48 del Código  */
	$"6465 2052 6567 6C61 6D65 6E74 6F73 2046"            /* de Reglamentos F */
	$"6564 6572 616C 6573 2C20 656E 2073 7520"            /* ederales, en su  */
	$"4172 7492 6375 6C6F 2031 322E 3231 3220"            /* Artículo 12.212  */
	$"2853 6570 7469 656D 6272 6520 6465 2031"            /* (Septiembre de 1 */
	$"3939 3529 2079 2065 6E20 656C 2054 9274"            /* 995) y en el Tít */
	$"756C 6F20 3438 2064 656C 2043 9764 6967"            /* ulo 48 del Códig */
	$"6F20 6465 2052 6567 6C61 6D65 6E74 6F73"            /* o de Reglamentos */
	$"2046 6564 6572 616C 6573 2C20 656E 2073"            /*  Federales, en s */
	$"7520 4172 7492 6375 6C6F 2032 3237 2E37"            /* u Artículo 227.7 */
	$"3230 3220 286A 756E 696F 2064 6520 3139"            /* 202 (junio de 19 */
	$"3935 292E 2043 6F6E 7369 7374 656E 7465"            /* 95). Consistente */
	$"2063 6F6E 2065 6C20 5492 7475 6C6F 2034"            /*  con el Título 4 */
	$"3820 6465 6C20 4397 6469 676F 2064 6520"            /* 8 del Código de  */
	$"5265 676C 616D 656E 746F 7320 4665 6465"            /* Reglamentos Fede */
	$"7261 6C65 732C 2065 6E20 7375 2041 7274"            /* rales, en su Art */
	$"9263 756C 6F20 3132 2E32 3132 2C20 6465"            /* ículo 12.212, de */
	$"6C20 5492 7475 6C6F 2034 3820 6465 6C20"            /* l Título 48 del  */
	$"4397 6469 676F 2064 6520 5265 676C 616D"            /* Código de Reglam */
	$"656E 746F 7320 4665 6465 7261 6C65 732C"            /* entos Federales, */
	$"2065 6E20 7375 2041 7274 9263 756C 6F20"            /*  en su Artículo  */
	$"3237 2E34 3035 2862 2928 3229 2028 4A75"            /* 27.405(b)(2) (Ju */
	$"6E69 6F20 3139 3938 2920 7920 6465 6C20"            /* nio 1998) y del  */
	$"5492 7475 6C6F 2034 3820 6465 6C20 4397"            /* Título 48 del Có */
	$"6469 676F 2064 6520 5265 676C 616D 656E"            /* digo de Reglamen */
	$"746F 7320 4665 6465 7261 6C65 732C 2065"            /* tos Federales, e */
	$"6E20 7375 2041 7274 9263 756C 6F20 3232"            /* n su Artículo 22 */
	$"372E 3732 3032 2C20 746F 646F 7320 6C6F"            /* 7.7202, todos lo */
	$"7320 7573 7561 7269 6F73 2066 696E 616C"            /* s usuarios final */
	$"6573 2064 656C 2067 6F62 6965 726E 6F20"            /* es del gobierno  */
	$"6465 206C 6F73 2045 7374 6164 6F73 2055"            /* de los Estados U */
	$"6E69 646F 7320 6164 7175 6965 7265 6E20"            /* nidos adquieren  */
	$"656C 2050 726F 6475 6374 6F20 7397 6C6F"            /* el Producto sólo */
	$"2063 6F6E 2061 7175 656C 6C6F 7320 6465"            /*  con aquellos de */
	$"7265 6368 6F73 2065 7374 6162 6C65 6369"            /* rechos estableci */
	$"646F 7320 656E 2065 6C20 7072 6573 656E"            /* dos en el presen */
	$"7465 2E0D 0D38 2E20 4D49 5343 454C E74E"            /* te...8. MISCELÁN */
	$"4541 532E 2028 6129 2045 6C20 7072 6573"            /* EAS. (a) El pres */
	$"656E 7465 2043 6F6E 7472 6174 6F20 636F"            /* ente Contrato co */
	$"6E73 7469 7475 7965 2065 6C20 6163 7565"            /* nstituye el acue */
	$"7264 6F20 636F 6D70 6C65 746F 2065 6E74"            /* rdo completo ent */
	$"7265 204D 6F7A 696C 6C61 2079 2075 7374"            /* re Mozilla y ust */
	$"6564 2C20 656E 2063 7561 6E74 6F20 636F"            /* ed, en cuanto co */
	$"6D70 6574 6520 616C 206F 626A 6574 6F20"            /* mpete al objeto  */
	$"7072 696E 6369 7061 6C20 6465 6C20 6D69"            /* principal del mi */
	$"736D 6F20 7920 7397 6C6F 2073 6520 7075"            /* smo y sólo se pu */
	$"6564 6520 6D6F 6469 6669 6361 7220 706F"            /* ede modificar po */
	$"7220 756E 6120 656E 6D69 656E 6461 2065"            /* r una enmienda e */
	$"7363 7269 7461 2C20 6669 726D 6164 6120"            /* scrita, firmada  */
	$"706F 7220 756E 2065 6A65 6375 7469 766F"            /* por un ejecutivo */
	$"2061 7574 6F72 697A 6164 6F20 6465 204D"            /*  autorizado de M */
	$"6F7A 696C 6C61 2E20 2862 2920 4578 6365"            /* ozilla. (b) Exce */
	$"7074 6F20 656E 206C 6120 6D65 6469 6461"            /* pto en la medida */
	$"2071 7565 206C 6120 6C65 7920 6170 6C69"            /*  que la ley apli */
	$"6361 626C 6520 D173 6920 6C61 2068 7562"            /* cable —si la hub */
	$"6965 7261 D120 6469 7370 6F6E 6761 206C"            /* iera— disponga l */
	$"6F20 636F 6E74 7261 7269 6F2C 2065 6C20"            /* o contrario, el  */
	$"7072 6573 656E 7465 2043 6F6E 7472 6174"            /* presente Contrat */
	$"6F20 7365 2072 6567 6972 8720 706F 7220"            /* o se regirá por  */
	$"6C61 7320 6C65 7965 7320 6465 6C20 4573"            /* las leyes del Es */
	$"7461 646F 2064 6520 4361 6C69 666F 726E"            /* tado de Californ */
	$"6961 2C20 4573 7461 646F 7320 556E 6964"            /* ia, Estados Unid */
	$"6F73 2064 6520 4E6F 7274 6520 416D 8E72"            /* os de Norte Amér */
	$"6963 612C 2063 6F6E 2065 7863 6C75 7369"            /* ica, con exclusi */
	$"976E 2064 6520 7375 7320 6469 7370 6F73"            /* ón de sus dispos */
	$"6963 696F 6E65 7320 7265 7370 6563 746F"            /* iciones respecto */
	$"2064 656C 2063 6F6E 666C 6963 746F 2064"            /*  del conflicto d */
	$"6520 6C65 7965 732E 2028 6329 2045 7374"            /* e leyes. (c) Est */
	$"6520 436F 6E74 7261 746F 206E 6F20 7365"            /* e Contrato no se */
	$"2072 6567 6972 8720 706F 7220 6C61 2043"            /*  regirá por la C */
	$"6F6E 7665 6E63 6997 6E20 6465 206C 6173"            /* onvención de las */
	$"204E 6163 696F 6E65 7320 556E 6964 6173"            /*  Naciones Unidas */
	$"2073 6F62 7265 2043 6F6E 7472 6174 6F73"            /*  sobre Contratos */
	$"2070 6172 6120 6C61 2056 656E 7461 2049"            /*  para la Venta I */
	$"6E74 6572 6E61 6369 6F6E 616C 2064 6520"            /* nternacional de  */
	$"4D65 7263 6164 6572 9261 732E 2028 6429"            /* Mercaderías. (d) */
	$"2053 6920 6375 616C 7175 6965 7220 7061"            /*  Si cualquier pa */
	$"7274 6520 6465 2065 7374 6520 436F 6E74"            /* rte de este Cont */
	$"7261 746F 2073 6520 6465 636C 6172 6173"            /* rato se declaras */
	$"6520 696E 7687 6C69 6461 206F 206E 6F20"            /* e inválida o no  */
	$"656A 6563 7574 6162 6C65 2C20 7365 2063"            /* ejecutable, se c */
	$"6F6E 7369 6465 7261 7287 2071 7565 2064"            /* onsiderará que d */
	$"6963 6861 2070 6172 7465 2072 6566 6C65"            /* icha parte refle */
	$"6A61 206C 6120 696E 7465 6E63 6997 6E20"            /* ja la intención  */
	$"6F72 6967 696E 616C 2064 6520 6C61 7320"            /* original de las  */
	$"7061 7274 6573 2079 2065 6C20 7265 7374"            /* partes y el rest */
	$"6F20 6465 2073 7573 2063 6C87 7573 756C"            /* o de sus cláusul */
	$"6173 2063 6F6E 7365 7276 6172 8720 7375"            /* as conservará su */
	$"2070 6C65 6E61 2076 6967 656E 6369 6120"            /*  plena vigencia  */
	$"7920 6566 6563 746F 2E20 2865 2920 556E"            /* y efecto. (e) Un */
	$"6120 7265 6E75 6E63 6961 2070 6F72 2070"            /* a renuncia por p */
	$"6172 7465 2064 6520 6375 616C 7175 6965"            /* arte de cualquie */
	$"7261 2064 6520 6C61 7320 7061 7274 6573"            /* ra de las partes */
	$"2061 2063 7561 6C71 7569 6572 6120 6465"            /*  a cualquiera de */
	$"206C 6F73 2074 8E72 6D69 6E6F 7320 6F20"            /*  los términos o  */
	$"636F 6E64 6963 696F 6E65 7320 6465 2065"            /* condiciones de e */
	$"7374 6520 436F 6E74 7261 746F 206F 2063"            /* ste Contrato o c */
	$"7561 6C71 7569 6572 2069 6E63 756D 706C"            /* ualquier incumpl */
	$"696D 6965 6E74 6F20 6465 6C20 6D69 736D"            /* imiento del mism */
	$"6F2C 2065 6E20 6375 616C 7175 6965 7220"            /* o, en cualquier  */
	$"696E 7374 616E 6369 612C 206E 6F20 7265"            /* instancia, no re */
	$"6E75 6E63 6961 7287 2061 2064 6963 686F"            /* nunciará a dicho */
	$"2074 8E72 6D69 6E6F 206F 2063 6F6E 6469"            /*  término o condi */
	$"6369 976E 206F 206E 696E 6775 6E61 2076"            /* ción o ninguna v */
	$"696F 6C61 6369 976E 2064 656C 206D 6973"            /* iolación del mis */
	$"6D6F 2E20 2866 2920 4578 6365 7074 6F20"            /* mo. (f) Excepto  */
	$"7365 679C 6E20 6C6F 2072 6571 7569 6572"            /* según lo requier */
	$"6120 6C61 206C 6579 2C20 656C 2069 6469"            /* a la ley, el idi */
	$"6F6D 6120 646F 6D69 6E61 6E74 6520 6465"            /* oma dominante de */
	$"6C20 436F 6E74 7261 746F 2065 7320 656C"            /* l Contrato es el */
	$"2069 6E67 6C8E 732E 2028 6729 2055 7374"            /*  inglés. (g) Ust */
	$"6564 2070 7565 6465 2063 6564 6572 206C"            /* ed puede ceder l */
	$"6F73 2064 6572 6563 686F 7320 7175 6520"            /* os derechos que  */
	$"6C65 2063 6F6D 7065 7465 6E20 656E 2076"            /* le competen en v */
	$"6972 7475 6420 6465 2065 7374 6520 436F"            /* irtud de este Co */
	$"6E74 7261 746F 2061 2063 7561 6C71 7569"            /* ntrato a cualqui */
	$"6572 2070 6172 7465 2071 7565 2063 6F6E"            /* er parte que con */
	$"7369 656E 7461 2061 2065 6C6C 6F20 7920"            /* sienta a ello y  */
	$"6163 6570 7465 2076 696E 6375 6C61 7273"            /* acepte vinculars */
	$"6520 706F 7220 6C6F 7320 748E 726D 696E"            /* e por los términ */
	$"6F73 2064 656C 206D 6973 6D6F 3B20 7468"            /* os del mismo; th */
	$"6520 4D6F 7A69 6C6C 6120 466F 756E 6461"            /* e Mozilla Founda */
	$"7469 6F6E 2070 7565 6465 2063 6564 6572"            /* tion puede ceder */
	$"2073 7573 2064 6572 6563 686F 7320 656E"            /*  sus derechos en */
	$"2076 6972 7475 6420 6465 2065 7374 6520"            /*  virtud de este  */
	$"436F 6E74 7261 746F 2C20 7369 6E20 636F"            /* Contrato, sin co */
	$"6E64 6963 6997 6E20 616C 6775 6E61 2E20"            /* ndición alguna.  */
	$"2868 2920 4573 7465 2043 6F6E 7472 6174"            /* (h) Este Contrat */
	$"6F20 7365 7287 2076 696E 6375 6C61 6E74"            /* o será vinculant */
	$"6520 7061 7261 206C 6173 2070 6172 7465"            /* e para las parte */
	$"732C 2073 7573 2073 7563 6573 6F72 6573"            /* s, sus sucesores */
	$"2079 2063 6573 696F 6E61 7269 6F73 2070"            /*  y cesionarios p */
	$"6572 6D69 7469 646F 7320 7920 7265 6475"            /* ermitidos y redu */
	$"6E64 6172 8720 656E 2062 656E 6566 6963"            /* ndará en benefic */
	$"696F 2064 6520 6C6F 7320 6D69 736D 6F73"            /* io de los mismos */
	$"2E"                                                 /* . */
};

data 'styl' (5004, "Spanish SLA") {
	$"0003 0000 0000 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 01AB 000F 000C 0400"            /* .........´...... */
	$"0190 000C 0000 0000 0000 0000 01E6 000F"            /* .ê...........Ê.. */
	$"000C 0400 0090 000C 0000 0000 0000"                 /* .....ê........ */
};

data 'TEXT' (5005, "Japanese SLA") {
	$"967B 96F3 95B6 82CD 8141 8E51 8D6C 82CC"            /* ñ{ñÛï∂ÇÕÅAéQçlÇÃ */
	$"82BD 82DF 82C9 8DEC 90AC 82B5 82BD 82E0"            /* ÇΩÇﬂÇ…çÏê¨ÇµÇΩÇ‡ */
	$"82CC 82C5 82A0 82E8 8141 8389 8343 835A"            /* ÇÃÇ≈Ç†ÇËÅAÉâÉCÉZ */
	$"8393 8358 82CC 93E0 9765 82F0 955C 8EA6"            /* ÉìÉXÇÃì‡óeÇï\é¶ */
	$"82B7 82E9 82E0 82CC 82C5 82CD 82A0 82E8"            /* Ç∑ÇÈÇ‡ÇÃÇ≈ÇÕÇ†ÇË */
	$"82DC 82B9 82F1 8142 8389 8343 835A 8393"            /* Ç‹ÇπÇÒÅBÉâÉCÉZÉì */
	$"8358 82CC 93E0 9765 82C9 82C2 82A2 82C4"            /* ÉXÇÃì‡óeÇ…Ç¬Ç¢Çƒ */
	$"82CD 8970 95B6 82CC 8C5F 96F1 82C9 82E6"            /* ÇÕâpï∂ÇÃå_ñÒÇ…ÇÊ */
	$"82E9 82E0 82CC 82C6 82B5 82DC 82B7 8142"            /* ÇÈÇ‡ÇÃÇ∆ÇµÇ‹Ç∑ÅB */
	$"967B 96F3 95B6 82C6 8970 95B6 82CC 8C5F"            /* ñ{ñÛï∂Ç∆âpï∂ÇÃå_ */
	$"96F1 82C9 96B5 8F82 82AA 82A0 82C1 82BD"            /* ñÒÇ…ñµèÇÇ™Ç†Ç¡ÇΩ */
	$"8FEA 8D87 82C9 82CD 8970 95B6 82CC 8C5F"            /* èÍçáÇ…ÇÕâpï∂ÇÃå_ */
	$"96F1 82AA 9744 90E6 82B5 82DC 82B7 8142"            /* ñÒÇ™óDêÊÇµÇ‹Ç∑ÅB */
	$"0D0D 4D4F 5A49 4C4C 4120 464F 554E 4441"            /* ..MOZILLA FOUNDA */
	$"5449 4F4E 0D0D 4341 4D49 4E4F 2083 4783"            /* TION..CAMINO ÉGÉ */
	$"9383 6883 8681 5B83 5583 5C83 7483 6783"            /* ìÉhÉÜÅ[ÉUÉ\ÉtÉgÉ */
	$"4583 4683 4183 8983 4383 5A83 9383 588C"            /* EÉFÉAÉâÉCÉZÉìÉXå */
	$"5F96 F10D 836F 815B 8357 8387 8393 2031"            /* _ñÒ.ÉoÅ[ÉWÉáÉì 1 */
	$"2E31 0D0D 4341 4D49 4E4F 2083 7583 8983"            /* .1..CAMINO ÉuÉâÉ */
	$"4583 5582 CC88 EA95 9482 CC8B 4094 5C82"            /* EÉUÇÃàÍïîÇÃã@î\Ç */
	$"C982 C282 A282 C482 CD81 4183 5C81 5B83"            /* …Ç¬Ç¢ÇƒÇÕÅAÉ\Å[É */
	$"5883 5281 5B83 6883 6F81 5B83 5783 8783"            /* XÉRÅ[ÉhÉoÅ[ÉWÉáÉ */
	$"9382 AA20 7777 772E 6D6F 7A69 6C6C 612E"            /* ìÇ™ www.mozilla. */
	$"6F72 6720 82A9 82E7 96B3 8F9E 82C5 93FC"            /* org Ç©ÇÁñ≥èûÇ≈ì¸ */
	$"8EE8 89C2 945C 82C5 8141 8347 8393 8368"            /* éËâ¬î\Ç≈ÅAÉGÉìÉh */
	$"8386 815B 8355 82CD 82B1 82EA 82F0 8E67"            /* ÉÜÅ[ÉUÇÕÇ±ÇÍÇég */
	$"9770 8141 95CF 8D58 8141 82A8 82E6 82D1"            /* ópÅAïœçXÅAÇ®ÇÊÇ— */
	$"947A 9574 82B7 82E9 82B1 82C6 82AA 82C5"            /* îzïtÇ∑ÇÈÇ±Ç∆Ç™Ç≈ */
	$"82AB 82DC 82B7 8142 82B1 82CC 835C 815B"            /* Ç´Ç‹Ç∑ÅBÇ±ÇÃÉ\Å[ */
	$"8358 8352 815B 8368 836F 815B 8357 8387"            /* ÉXÉRÅ[ÉhÉoÅ[ÉWÉá */
	$"8393 82CD 204D 6F7A 696C 6C61 2050 7562"            /* ÉìÇÕ Mozilla Pub */
	$"6C69 6320 4C69 6365 6E73 6520 82A8 82E6"            /* lic License Ç®ÇÊ */
	$"82D1 82BB 82CC 91BC 82CC 8349 815B 8376"            /* Ç—ÇªÇÃëºÇÃÉIÅ[Év */
	$"8393 835C 815B 8358 835C 8374 8367 8345"            /* ÉìÉ\Å[ÉXÉ\ÉtÉgÉE */
	$"8346 8341 8389 8343 835A 8393 8358 2082"            /* ÉFÉAÉâÉCÉZÉìÉX Ç */
	$"CC8F F08C 8F82 C98A EE82 C382 A282 C492"            /* ÃèåèÇ…äÓÇ√Ç¢Çƒí */
	$"F18B 9F82 B382 EA82 DC82 B781 420D 0D82"            /* ÒãüÇ≥ÇÍÇ‹Ç∑ÅB..Ç */
	$"B182 CC8C 5F96 F182 AA93 5995 7482 B382"            /* ±ÇÃå_ñÒÇ™ìYïtÇ≥Ç */
	$"EA82 C482 A282 E920 4341 4D49 4E4F 2082"            /* ÍÇƒÇ¢ÇÈ CAMINO Ç */
	$"CC8E C08D 7389 C294 5C83 5281 5B83 6883"            /* Ãé¿çsâ¬î\ÉRÅ[ÉhÉ */
	$"6F81 5B83 5783 8783 9382 A882 E682 D18A"            /* oÅ[ÉWÉáÉìÇ®ÇÊÇ—ä */
	$"D698 4195 B68F 9120 2881 7596 7B90 BB95"            /* ÷òAï∂èë (Åuñ{êªï */
	$"6981 7629 2082 CD81 4182 B182 CC20 4341"            /* iÅv) ÇÕÅAÇ±ÇÃ CA */
	$"4D49 4E4F 2083 4783 9383 6883 8681 5B83"            /* MINO ÉGÉìÉhÉÜÅ[É */
	$"5583 5C83 7483 6783 4583 4683 4183 8983"            /* UÉ\ÉtÉgÉEÉFÉAÉâÉ */
	$"4383 5A83 9383 5820 2881 7596 7B8C 5F96"            /* CÉZÉìÉX (Åuñ{å_ñ */
	$"F181 7629 2082 CC8F F08C 8F82 C98A EE82"            /* ÒÅv) ÇÃèåèÇ…äÓÇ */
	$"C382 A282 C492 F18B 9F82 B382 EA82 DC82"            /* √Ç¢ÇƒíÒãüÇ≥ÇÍÇ‹Ç */
	$"B781 4283 4783 9383 6883 8681 5B83 5582"            /* ∑ÅBÉGÉìÉhÉÜÅ[ÉUÇ */
	$"CD81 4181 7593 AF88 D382 B782 E920 2841"            /* ÕÅAÅuìØà”Ç∑ÇÈ (A */
	$"6363 6570 7429 8176 837B 835E 8393 82F0"            /* ccept)ÅvÉ{É^ÉìÇ */
	$"834E 838A 8362 834E 8141 82DC 82BD 82CD"            /* ÉNÉäÉbÉNÅAÇ‹ÇΩÇÕ */
	$"2043 414D 494E 4F20 8375 8389 8345 8355"            /*  CAMINO ÉuÉâÉEÉU */
	$"82F0 8343 8393 8358 8367 815B 838B 82E0"            /* ÇÉCÉìÉXÉgÅ[ÉãÇ‡ */
	$"82B5 82AD 82CD 8E67 9770 82B7 82E9 82B1"            /* ÇµÇ≠ÇÕégópÇ∑ÇÈÇ± */
	$"82C6 82C5 8141 967B 8C5F 96F1 82C9 8D53"            /* Ç∆Ç≈ÅAñ{å_ñÒÇ…çS */
	$"91A9 82B3 82EA 82E9 82B1 82C6 82C9 93AF"            /* ë©Ç≥ÇÍÇÈÇ±Ç∆Ç…ìØ */
	$"88D3 82B7 82E9 82B1 82C6 82C9 82C8 82E8"            /* à”Ç∑ÇÈÇ±Ç∆Ç…Ç»ÇË */
	$"82DC 82B7 8142 967B 8C5F 96F1 82CC 8FF0"            /* Ç‹Ç∑ÅBñ{å_ñÒÇÃè */
	$"8C8F 82C9 93AF 88D3 82B5 82C8 82A2 8FEA"            /* åèÇ…ìØà”ÇµÇ»Ç¢èÍ */
	$"8D87 82CD 8141 8175 93AF 88D3 82B7 82E9"            /* çáÇÕÅAÅuìØà”Ç∑ÇÈ */
	$"2028 4163 6365 7074 2981 7683 7B83 5E83"            /*  (Accept)ÅvÉ{É^É */
	$"9382 F083 4E83 8A83 6283 4E82 B982 B882"            /* ìÇÉNÉäÉbÉNÇπÇ∏Ç */
	$"C981 4143 414D 494E 4F20 8375 8389 8345"            /* …ÅACAMINO ÉuÉâÉE */
	$"8355 82CC 82A2 82B8 82EA 82CC 9594 95AA"            /* ÉUÇÃÇ¢Ç∏ÇÍÇÃïîï™ */
	$"82E0 8343 8393 8358 8367 815B 838B 82DC"            /* Ç‡ÉCÉìÉXÉgÅ[ÉãÇ‹ */
	$"82BD 82CD 8E67 9770 82B5 82C8 82A2 82C5"            /* ÇΩÇÕégópÇµÇ»Ç¢Ç≈ */
	$"82AD 82BE 82B3 82A2 8142 0D0D 4341 4D49"            /* Ç≠ÇæÇ≥Ç¢ÅB..CAMI */
	$"4E4F 2082 CC83 4383 9383 5883 6781 5B83"            /* NO ÇÃÉCÉìÉXÉgÅ[É */
	$"8B92 8682 DC82 BD82 CD83 4383 9383 5883"            /* ãíÜÇ‹ÇΩÇÕÉCÉìÉXÉ */
	$"6781 5B83 8B8C E382 C981 4183 5481 5B83"            /* gÅ[Éãå„Ç…ÅAÉTÅ[É */
	$"6883 7081 5B83 6583 4283 5C83 7483 6783"            /* hÉpÅ[ÉeÉBÉ\ÉtÉgÉ */
	$"4583 4683 4183 7683 8D83 6F83 4383 5F82"            /* EÉFÉAÉvÉçÉoÉCÉ_Ç */
	$"A982 E792 F18B 9F82 B382 EA82 E992 C789"            /* ©ÇÁíÒãüÇ≥ÇÍÇÈí«â */
	$"C183 5283 9383 7C81 5B83 6C83 9383 6782"            /* ¡ÉRÉìÉ|Å[ÉlÉìÉgÇ */
	$"CC92 C789 C182 F091 4991 F082 C582 AB82"            /* Ãí«â¡ÇëIëÇ≈Ç´Ç */
	$"E98F EA8D 8782 AA82 A082 E882 DC82 B781"            /* ÈèÍçáÇ™Ç†ÇËÇ‹Ç∑Å */
	$"4282 BB82 CC82 E682 A482 C883 5481 5B83"            /* BÇªÇÃÇÊÇ§Ç»ÉTÅ[É */
	$"6883 7081 5B83 6583 4282 CC83 5283 9383"            /* hÉpÅ[ÉeÉBÇÃÉRÉìÉ */
	$"7C81 5B83 6C83 9383 6782 CC83 4383 9383"            /* |Å[ÉlÉìÉgÇÃÉCÉìÉ */
	$"5883 6781 5B83 8B82 A882 E682 D18E 6797"            /* XÉgÅ[ÉãÇ®ÇÊÇ—égó */
	$"7082 C982 CD81 4192 C789 C182 CC83 8983"            /* pÇ…ÇÕÅAí«â¡ÇÃÉâÉ */
	$"4383 5A83 9383 588C 5F96 F182 AA93 4B97"            /* CÉZÉìÉXå_ñÒÇ™ìKó */
	$"7082 B382 EA82 E98F EA8D 8782 AA82 A082"            /* pÇ≥ÇÍÇÈèÍçáÇ™Ç†Ç */
	$"E882 DC82 B781 420D 0D31 2E20 8389 8343"            /* ËÇ‹Ç∑ÅB..1. ÉâÉC */
	$"835A 8393 8358 82CC 8B96 91F8 0D4D 6F7A"            /* ÉZÉìÉXÇÃãñë¯.Moz */
	$"696C 6C61 2046 6F75 6E64 6174 696F 6E20"            /* illa Foundation  */
	$"82CD 8347 8393 8368 8386 815B 8355 82C9"            /* ÇÕÉGÉìÉhÉÜÅ[ÉUÇ… */
	$"91CE 82B5 8141 967B 90BB 9569 82CC 8EC0"            /* ëŒÇµÅAñ{êªïiÇÃé¿ */
	$"8D73 89C2 945C 8352 815B 8368 836F 815B"            /* çsâ¬î\ÉRÅ[ÉhÉoÅ[ */
	$"8357 8387 8393 82F0 8E67 9770 82B7 82E9"            /* ÉWÉáÉìÇégópÇ∑ÇÈ */
	$"82B1 82C6 82CC 82C5 82AB 82E9 94F1 93C6"            /* Ç±Ç∆ÇÃÇ≈Ç´ÇÈîÒì∆ */
	$"90E8 9349 82C8 8CA0 9798 82F0 8B96 91F8"            /* êËìIÇ»å†óòÇãñë¯ */
	$"82B5 82DC 82B7 8142 967B 8C5F 96F1 82CD"            /* ÇµÇ‹Ç∑ÅBñ{å_ñÒÇÕ */
	$"8141 4D6F 7A69 6C6C 6120 82AA 92F1 8B9F"            /* ÅAMozilla Ç™íÒãü */
	$"82B7 82E9 8141 8CB3 82CC 967B 90BB 9569"            /* Ç∑ÇÈÅAå≥ÇÃñ{êªïi */
	$"82C9 9275 82AB 91D6 82ED 82E9 8141 82DC"            /* Ç…íuÇ´ë÷ÇÌÇÈÅAÇ‹ */
	$"82BD 82CD 8CB3 82CC 967B 90BB 9569 82F0"            /* ÇΩÇÕå≥ÇÃñ{êªïiÇ */
	$"95E2 8AAE 82B7 82E9 8141 82B7 82D7 82C4"            /* ï‚äÆÇ∑ÇÈÅAÇ∑Ç◊Çƒ */
	$"82CC 835C 8374 8367 8345 8346 8341 8341"            /* ÇÃÉ\ÉtÉgÉEÉFÉAÉA */
	$"8362 8376 834F 838C 815B 8368 82C9 82E0"            /* ÉbÉvÉOÉåÅ[ÉhÇ…Ç‡ */
	$"934B 9770 82B3 82EA 82DC 82B7 8142 82BD"            /* ìKópÇ≥ÇÍÇ‹Ç∑ÅBÇΩ */
	$"82BE 82B5 8141 82BB 82CC 82E6 82A4 82C8"            /* ÇæÇµÅAÇªÇÃÇÊÇ§Ç» */
	$"8341 8362 8376 834F 838C 815B 8368 82C9"            /* ÉAÉbÉvÉOÉåÅ[ÉhÇ… */
	$"95CA 82CC 8389 8343 835A 8393 8358 82AA"            /* ï ÇÃÉâÉCÉZÉìÉXÇ™ */
	$"9359 9574 82B3 82EA 82BD 8FEA 8D87 82CD"            /* ìYïtÇ≥ÇÍÇΩèÍçáÇÕ */
	$"8141 967B 8C5F 96F1 82CD 934B 9770 82B3"            /* ÅAñ{å_ñÒÇÕìKópÇ≥ */
	$"82EA 82B8 8141 82BB 82CC 8389 8343 835A"            /* ÇÍÇ∏ÅAÇªÇÃÉâÉCÉZ */
	$"8393 8358 82CC 8FF0 8C8F 82AA 934B 9770"            /* ÉìÉXÇÃèåèÇ™ìKóp */
	$"82B3 82EA 82DC 82B7 8142 0D0D 322E 2083"            /* Ç≥ÇÍÇ‹Ç∑ÅB..2. É */
	$"8983 4383 5A83 9383 5882 CC8F 4997 B90D"            /* âÉCÉZÉìÉXÇÃèIóπ. */
	$"8347 8393 8368 8386 815B 8355 82AA 967B"            /* ÉGÉìÉhÉÜÅ[ÉUÇ™ñ{ */
	$"8C5F 96F1 82C9 88E1 94BD 82B5 82BD 8FEA"            /* å_ñÒÇ…à·îΩÇµÇΩèÍ */
	$"8D87 8141 8347 8393 8368 8386 815B 8355"            /* çáÅAÉGÉìÉhÉÜÅ[ÉU */
	$"82AA 967B 90BB 9569 82F0 8E67 9770 82B7"            /* Ç™ñ{êªïiÇégópÇ∑ */
	$"82E9 8CA0 9798 82CD 8141 82BD 82BE 82BF"            /* ÇÈå†óòÇÕÅAÇΩÇæÇø */
	$"82C9 8141 92CA 926D 82C8 82AD 8F49 97B9"            /* Ç…ÅAí ímÇ»Ç≠èIóπ */
	$"82B5 82DC 82B7 8142 82BD 82BE 82B5 8141"            /* ÇµÇ‹Ç∑ÅBÇΩÇæÇµÅA */
	$"8389 8343 835A 8393 8358 82CC 8B96 91F8"            /* ÉâÉCÉZÉìÉXÇÃãñë¯ */
	$"2028 91E6 2031 208F F029 2082 F08F 9C82"            /*  (ëÊ 1 è) ÇèúÇ */
	$"AD82 B782 D782 C482 CC8F F08D 8082 CD96"            /* ≠Ç∑Ç◊ÇƒÇÃèçÄÇÕñ */
	$"7B8C 5F96 F182 CC8F 4997 B98C E382 E097"            /* {å_ñÒÇÃèIóπå„Ç‡ó */
	$"4C8C F882 C991 B691 B182 B582 DC82 B781"            /* Lå¯Ç…ë∂ë±ÇµÇ‹Ç∑Å */
	$"4296 7B8C 5F96 F18F 4997 B98C E382 B782"            /* Bñ{å_ñÒèIóπå„Ç∑Ç */
	$"DD82 E282 A982 C981 4183 4783 9383 6883"            /* ›Ç‚Ç©Ç…ÅAÉGÉìÉhÉ */
	$"8681 5B83 5582 CD96 7B90 BB95 6982 CC82"            /* ÜÅ[ÉUÇÕñ{êªïiÇÃÇ */
	$"B782 D782 C482 CC83 5283 7381 5B82 F094"            /* ∑Ç◊ÇƒÇÃÉRÉsÅ[Çî */
	$"6A8A FC82 B582 C882 AF82 EA82 CE82 C882"            /* jä¸ÇµÇ»ÇØÇÍÇŒÇ»Ç */
	$"E882 DC82 B982 F181 420D 0D33 2E20 8DE0"            /* ËÇ‹ÇπÇÒÅB..3. ç‡ */
	$"8E59 9349 8CA0 9798 0D96 7B90 BB95 6982"            /* éYìIå†óò.ñ{êªïiÇ */
	$"CC88 EA95 9482 CC83 5C81 5B83 5883 5281"            /* ÃàÍïîÇÃÉ\Å[ÉXÉRÅ */
	$"5B83 6882 CD81 414D 6F7A 696C 6C61 2050"            /* [ÉhÇÕÅAMozilla P */
	$"7562 6C69 6320 4C69 6365 6E73 6520 82A8"            /* ublic License Ç® */
	$"82E6 82D1 82BB 82CC 91BC 82CC 8349 815B"            /* ÇÊÇ—ÇªÇÃëºÇÃÉIÅ[ */
	$"8376 8393 835C 815B 8358 8389 8343 835A"            /* ÉvÉìÉ\Å[ÉXÉâÉCÉZ */
	$"8393 8358 2028 918D 8FCC 82B5 82C4 8175"            /* ÉìÉX (ëçèÃÇµÇƒÅu */
	$"8349 815B 8376 8393 835C 815B 8358 8389"            /* ÉIÅ[ÉvÉìÉ\Å[ÉXÉâ */
	$"8343 835A 8393 8358 8176 2920 82CC 8FF0"            /* ÉCÉZÉìÉXÅv) ÇÃè */
	$"8C8F 82C9 8AEE 82C3 82A2 82C4 2068 7474"            /* åèÇ…äÓÇ√Ç¢Çƒ htt */
	$"703A 2F2F 7777 772E 6D6F 7A69 6C6C 612E"            /* p://www.mozilla. */
	$"6F72 6720 82A9 82E7 93FC 8EE8 82C5 82AB"            /* org Ç©ÇÁì¸éËÇ≈Ç´ */
	$"82DC 82B7 8142 967B 8C5F 96F1 82CC 8B4B"            /* Ç‹Ç∑ÅBñ{å_ñÒÇÃãK */
	$"92E8 82CD 8141 8349 815B 8376 8393 835C"            /* íËÇÕÅAÉIÅ[ÉvÉìÉ\ */
	$"815B 8358 8389 8343 835A 8393 8358 82C9"            /* Å[ÉXÉâÉCÉZÉìÉXÇ… */
	$"82E6 82E8 8B96 91F8 82B3 82EA 82E9 8CA0"            /* ÇÊÇËãñë¯Ç≥ÇÍÇÈå† */
	$"9798 82F0 89BD 82E7 90A7 8CC0 82B7 82E9"            /* óòÇâΩÇÁêßå¿Ç∑ÇÈ */
	$"82E0 82CC 82C5 82CD 82A0 82E8 82DC 82B9"            /* Ç‡ÇÃÇ≈ÇÕÇ†ÇËÇ‹Çπ */
	$"82F1 8142 8FE3 8B4C 82C6 90AE 8D87 82B7"            /* ÇÒÅBè„ãLÇ∆êÆçáÇ∑ */
	$"82E9 94CD 88CD 93E0 82C5 8141 4D6F 7A69"            /* ÇÈîÕàÕì‡Ç≈ÅAMozi */
	$"6C6C 6120 82CD 8141 8EA9 9067 82C6 82B5"            /* lla ÇÕÅAé©êgÇ∆Çµ */
	$"82C4 82A8 82E6 82D1 82BB 82CC 8389 8343"            /* ÇƒÇ®ÇÊÇ—ÇªÇÃÉâÉC */
	$"835A 8393 8354 82C9 91E3 82ED 82C1 82C4"            /* ÉZÉìÉTÇ…ë„ÇÌÇ¡Çƒ */
	$"8141 967B 8C5F 96F1 82C5 96BE 8EA6 9349"            /* ÅAñ{å_ñÒÇ≈ñæé¶ìI */
	$"82C9 8B96 91F8 82B3 82EA 82BD 8CA0 9798"            /* Ç…ãñë¯Ç≥ÇÍÇΩå†óò */
	$"82F0 8F9C 82AB 8141 967B 90BB 9569 82C9"            /* ÇèúÇ´ÅAñ{êªïiÇ… */
	$"8AD6 82B7 82E9 82B7 82D7 82C4 82CC 926D"            /* ä÷Ç∑ÇÈÇ∑Ç◊ÇƒÇÃím */
	$"9349 8DE0 8E59 8CA0 82F0 97AF 95DB 82B5"            /* ìIç‡éYå†ÇóØï€Çµ */
	$"82DC 82B7 8142 8347 8393 8368 8386 815B"            /* Ç‹Ç∑ÅBÉGÉìÉhÉÜÅ[ */
	$"8355 82CD 8141 967B 90BB 9569 82C9 9574"            /* ÉUÇÕÅAñ{êªïiÇ…ït */
	$"82B3 82EA 82BD 8FA4 9557 8141 838D 8353"            /* Ç≥ÇÍÇΩè§ïWÅAÉçÉS */
	$"8141 9298 8DEC 8CA0 8141 82DC 82BD 82CD"            /* ÅAíòçÏå†ÅAÇ‹ÇΩÇÕ */
	$"82BB 82CC 91BC 82CC 8DE0 8E59 9349 8CA0"            /* ÇªÇÃëºÇÃç‡éYìIå† */
	$"9798 82C9 8AD6 82B7 82E9 955C 8EA6 82F0"            /* óòÇ…ä÷Ç∑ÇÈï\é¶Ç */
	$"88EA 90D8 8F9C 8B8E 82DC 82BD 82CD 95CF"            /* àÍêÿèúãéÇ‹ÇΩÇÕïœ */
	$"8D58 82B5 82C8 82A2 82E0 82CC 82C6 82B5"            /* çXÇµÇ»Ç¢Ç‡ÇÃÇ∆Çµ */
	$"82DC 82B7 8142 82B1 82CC 8389 8343 835A"            /* Ç‹Ç∑ÅBÇ±ÇÃÉâÉCÉZ */
	$"8393 8358 82C9 82E6 82E8 8141 4D6F 7A69"            /* ÉìÉXÇ…ÇÊÇËÅAMozi */
	$"6C6C 6120 82DC 82BD 82CD 82BB 82CC 8389"            /* lla Ç‹ÇΩÇÕÇªÇÃÉâ */
	$"8343 835A 8393 8354 82CC 8FA4 9557 8141"            /* ÉCÉZÉìÉTÇÃè§ïWÅA */
	$"8354 815B 8372 8358 837D 815B 834E 8141"            /* ÉTÅ[ÉrÉXÉ}Å[ÉNÅA */
	$"82DC 82BD 82CD 838D 8353 82F0 8E67 9770"            /* Ç‹ÇΩÇÕÉçÉSÇégóp */
	$"82B7 82E9 8CA0 9798 82AA 8B96 91F8 82B3"            /* Ç∑ÇÈå†óòÇ™ãñë¯Ç≥ */
	$"82EA 82E9 82E0 82CC 82C5 82CD 82A0 82E8"            /* ÇÍÇÈÇ‡ÇÃÇ≈ÇÕÇ†ÇË */
	$"82DC 82B9 82F1 8142 0D0D 342E 2095 DB8F"            /* Ç‹ÇπÇÒÅB..4. ï€è */
	$"D882 CC94 DB94 460D 967B 90BB 9569 82CD"            /* ÿÇÃî€îF.ñ{êªïiÇÕ */
	$"8141 8C87 8AD7 82E0 8ADC 82DF 8175 8CBB"            /* ÅAåáä◊Ç‡ä‹ÇﬂÅuåª */
	$"8FF3 82CC 82DC 82DC 8176 82C5 92F1 8B9F"            /* èÛÇÃÇ‹Ç‹ÅvÇ≈íÒãü */
	$"82B3 82EA 82E9 82E0 82CC 82C5 82B7 8142"            /* Ç≥ÇÍÇÈÇ‡ÇÃÇ≈Ç∑ÅB */
	$"9640 82C9 82E6 82E8 8B96 91F8 82B3 82EA"            /* ñ@Ç…ÇÊÇËãñë¯Ç≥ÇÍ */
	$"82E9 94CD 88CD 93E0 82C9 82A8 82A2 82C4"            /* ÇÈîÕàÕì‡Ç…Ç®Ç¢Çƒ */
	$"8141 4D6F 7A69 6C6C 6120 82C8 82E7 82D1"            /* ÅAMozilla Ç»ÇÁÇ— */
	$"82C9 204D 6F7A 696C 6C61 2082 CC83 6683"            /* Ç… Mozilla ÇÃÉfÉ */
	$"4283 5883 6783 8A83 7283 8581 5B83 5E81"            /* BÉXÉgÉäÉrÉÖÅ[É^Å */
	$"4182 A882 E682 D183 8983 4383 5A83 9383"            /* AÇ®ÇÊÇ—ÉâÉCÉZÉìÉ */
	$"5482 CD81 4182 A082 E782 E482 E996 BE8E"            /* TÇÕÅAÇ†ÇÁÇ‰ÇÈñæé */
	$"A693 4982 A882 E682 D196 D98E A693 4982"            /* ¶ìIÇ®ÇÊÇ—ñŸé¶ìIÇ */
	$"C895 DB8F D882 F094 DB94 4682 B582 DC82"            /* »ï€èÿÇî€îFÇµÇ‹Ç */
	$"B781 4294 DB94 4682 B382 EA82 E995 DB8F"            /* ∑ÅBî€îFÇ≥ÇÍÇÈï€è */
	$"D882 C982 CD81 4196 7B90 BB95 6982 C98C"            /* ÿÇ…ÇÕÅAñ{êªïiÇ…å */
	$"878A D782 AA82 C882 A282 B182 C681 418F"            /* áä◊Ç™Ç»Ç¢Ç±Ç∆ÅAè */
	$"A48B C690 AB82 AA82 A082 E982 B182 C681"            /* §ã∆ê´Ç™Ç†ÇÈÇ±Ç∆Å */
	$"4196 7B90 BB95 6982 AA93 C192 E882 CC96"            /* Añ{êªïiÇ™ì¡íËÇÃñ */
	$"DA93 4982 C993 4B8D 8782 B782 E982 B182"            /* ⁄ìIÇ…ìKçáÇ∑ÇÈÇ±Ç */
	$"C681 4182 A882 E682 D18C A097 9882 F090"            /* ∆ÅAÇ®ÇÊÇ—å†óòÇê */
	$"4E8A 5182 B582 C882 A282 B182 C682 CC95"            /* NäQÇµÇ»Ç¢Ç±Ç∆ÇÃï */
	$"DB8F D882 AA8A DC82 DC82 EA82 DC82 B782"            /* €èÿÇ™ä‹Ç‹ÇÍÇ‹Ç∑Ç */
	$"AA81 4182 B182 EA82 E782 C98C C092 E882"            /* ™ÅAÇ±ÇÍÇÁÇ…å¿íËÇ */
	$"B382 EA82 DC82 B982 F181 4296 DA93 4982"            /* ≥ÇÍÇ‹ÇπÇÒÅBñ⁄ìIÇ */
	$"C991 CE82 B782 E990 BB95 6982 CC91 4991"            /* …ëŒÇ∑ÇÈêªïiÇÃëIë */
	$"F081 4182 C882 E782 D182 C990 BB95 6982"            /* ÅAÇ»ÇÁÇ—Ç…êªïiÇ */
	$"CC95 698E BF82 A882 E682 D190 AB94 5C82"            /* ÃïiéøÇ®ÇÊÇ—ê´î\Ç */
	$"C98A D682 B782 E983 8A83 5883 4E82 CD81"            /* …ä÷Ç∑ÇÈÉäÉXÉNÇÕÅ */
	$"4182 B782 D782 C483 4783 9383 6883 8681"            /* AÇ∑Ç◊ÇƒÉGÉìÉhÉÜÅ */
	$"5B83 5582 AA95 8982 A282 DC82 B781 4282"            /* [ÉUÇ™ïâÇ¢Ç‹Ç∑ÅBÇ */
	$"B182 CC8F F08D 8082 CD81 418B 7E8D CF95"            /* ±ÇÃèçÄÇÕÅAã~çœï */
	$"FB96 4082 AA96 7B97 8882 CC96 DA93 4982"            /* ˚ñ@Ç™ñ{óàÇÃñ⁄ìIÇ */
	$"F089 CA82 BD82 B382 C882 A282 B182 C682"            /* â ÇΩÇ≥Ç»Ç¢Ç±Ç∆Ç */
	$"C982 C882 E98F EA8D 8782 C582 E082 BB82"            /* …Ç»ÇÈèÍçáÇ≈Ç‡ÇªÇ */
	$"EA82 C982 A982 A982 ED82 E782 B893 4B97"            /* ÍÇ…Ç©Ç©ÇÌÇÁÇ∏ìKó */
	$"7082 B382 EA82 DC82 B781 428D 9182 E292"            /* pÇ≥ÇÍÇ‹Ç∑ÅBçëÇ‚í */
	$"6E88 E682 C982 E682 C182 C482 CD96 D98E"            /* nàÊÇ…ÇÊÇ¡ÇƒÇÕñŸé */
	$"A693 4982 C895 DB8F D882 CC8F 9C8A 4F82"            /* ¶ìIÇ»ï€èÿÇÃèúäOÇ */
	$"DC82 BD82 CD90 A78C C082 AA96 4097 A58F"            /* ‹ÇΩÇÕêßå¿Ç™ñ@ó•è */
	$"E394 4682 DF82 E782 EA82 C882 A28F EA8D"            /* „îFÇﬂÇÁÇÍÇ»Ç¢èÍç */
	$"8782 AA82 A082 E882 DC82 B782 AA81 4182"            /* áÇ™Ç†ÇËÇ‹Ç∑Ç™ÅAÇ */
	$"BB82 CC8F EA8D 8782 C982 CD82 B182 CC8F"            /* ªÇÃèÍçáÇ…ÇÕÇ±ÇÃè */
	$"F08D 8082 CD93 4B97 7082 B382 EA82 DC82"            /* çÄÇÕìKópÇ≥ÇÍÇ‹Ç */
	$"B982 F181 420D 0D35 2E20 90D3 9443 82CC"            /* πÇÒÅB..5. ê”îCÇÃ */
	$"90A7 8CC0 0D96 4082 CC92 E882 DF82 C982"            /* êßå¿.ñ@ÇÃíËÇﬂÇ…Ç */
	$"E682 E98F EA8D 8782 F08F 9C82 AB81 414D"            /* ÊÇÈèÍçáÇèúÇ´ÅAM */
	$"6F7A 696C 6C61 2082 C882 E782 D182 C982"            /* ozilla Ç»ÇÁÇ—Ç…Ç */
	$"BB82 CC83 6683 4283 5883 6783 8A83 7283"            /* ªÇÃÉfÉBÉXÉgÉäÉrÉ */
	$"8581 5B83 5E81 4196 F088 F581 4183 8983"            /* ÖÅ[É^ÅAñàıÅAÉâÉ */
	$"4383 5A83 9383 5481 418D 768C A38E D281"            /* CÉZÉìÉTÅAçvå£é“Å */
	$"4182 A882 E682 D191 E397 9D90 6C20 2891"            /* AÇ®ÇÊÇ—ë„óùêl (ë */
	$"8D8F CC82 B582 C481 754D 6F7A 696C 6C61"            /* çèÃÇµÇƒÅuMozilla */
	$"2083 4F83 8B81 5B83 7681 7629 2082 CD81"            /*  ÉOÉãÅ[ÉvÅv) ÇÕÅ */
	$"4196 7B8C 5F96 F181 4182 DC82 BD82 CD96"            /* Añ{å_ñÒÅAÇ‹ÇΩÇÕñ */
	$"7B90 BB95 6982 CC8E 6797 7082 E082 B582"            /* {êªïiÇÃégópÇ‡ÇµÇ */
	$"AD82 CD8E 6797 7082 C582 AB82 C882 A282"            /* ≠ÇÕégópÇ≈Ç´Ç»Ç¢Ç */
	$"B182 C682 C98B 4E88 F682 DC82 BD82 CD82"            /* ±Ç∆Ç…ãNàˆÇ‹ÇΩÇÕÇ */
	$"A282 A982 C882 E98C 6082 C982 A882 A282"            /* ¢Ç©Ç»ÇÈå`Ç…Ç®Ç¢Ç */
	$"C482 E08A D698 4182 B582 C490 B682 B682"            /* ƒÇ‡ä÷òAÇµÇƒê∂Ç∂Ç */
	$"BD81 418A D490 DA93 4991 B98A 5181 4193"            /* ΩÅAä‘ê⁄ìIëπäQÅAì */
	$"C195 CA91 B98A 5181 4195 7490 8F93 4991"            /* ¡ï ëπäQÅAïtêèìIë */
	$"B98A 5181 4194 6890 B693 4991 B98A 5181"            /* πäQÅAîhê∂ìIëπäQÅ */
	$"4182 DC82 BD82 CD92 A694 B193 4991 B98A"            /* AÇ‹ÇΩÇÕí¶î±ìIëπä */
	$"5182 C98A D682 B582 C488 EA90 D890 D394"            /* QÇ…ä÷ÇµÇƒàÍêÿê”î */
	$"4382 F095 8982 A282 DC82 B982 F181 4290"            /* CÇïâÇ¢Ç‹ÇπÇÒÅBê */
	$"D394 4382 F095 8982 ED82 C882 A291 B98A"            /* ”îCÇïâÇÌÇ»Ç¢ëπä */
	$"5182 C982 CD81 418F A48B C68F E382 CC90"            /* QÇ…ÇÕÅAè§ã∆è„ÇÃê */
	$"4D97 7082 CC91 728E B881 418B C696 B192"            /* MópÇÃëré∏ÅAã∆ñ±í */
	$"E28E 7E81 4188 ED8E B897 9889 7681 4183"            /* ‚é~ÅAàÌé∏óòâvÅAÉ */
	$"6681 5B83 5E82 CC91 728E B881 4182 A882"            /* fÅ[É^ÇÃëré∏ÅAÇ®Ç */
	$"E682 D183 5283 9383 7383 8581 5B83 5E82"            /* ÊÇ—ÉRÉìÉsÉÖÅ[É^Ç */
	$"CC91 B98F 9D82 DC82 BD82 CD8C EB93 AE8D"            /* ÃëπèùÇ‹ÇΩÇÕåÎìÆç */
	$"EC82 AA8A DC82 DC82 EA82 DC82 B782 AA81"            /* ÏÇ™ä‹Ç‹ÇÍÇ‹Ç∑Ç™Å */
	$"4182 B182 EA82 E782 C98C C092 E882 B382"            /* AÇ±ÇÍÇÁÇ…å¿íËÇ≥Ç */
	$"EA82 DC82 B982 F181 4290 D394 4382 F095"            /* ÍÇ‹ÇπÇÒÅBê”îCÇï */
	$"8982 ED82 C882 A282 B182 C682 CD81 4182"            /* âÇÌÇ»Ç¢Ç±Ç∆ÇÕÅAÇ */
	$"BB82 CC82 E682 A482 C891 B98A 5182 CC89"            /* ªÇÃÇÊÇ§Ç»ëπäQÇÃâ */
	$"C294 5C90 AB82 C982 C282 A282 C48D 9092"            /* ¬î\ê´Ç…Ç¬Ç¢Çƒçêí */
	$"6D82 B382 EA82 C482 A282 BD8F EA8D 8782"            /* mÇ≥ÇÍÇƒÇ¢ÇΩèÍçáÇ */
	$"C582 E093 AF97 6C82 C581 4182 DC82 BD91"            /* ≈Ç‡ìØólÇ≈ÅAÇ‹ÇΩë */
	$"6982 A682 CC8D AA8B 9282 AA82 C782 CC82"            /* iÇ¶ÇÃç™ãíÇ™Ç«ÇÃÇ */
	$"E682 A482 C88C B497 9D20 288C 5F96 F181"            /* ÊÇ§Ç»å¥óù (å_ñÒÅ */
	$"4195 7396 408D 7388 D782 DC82 BD82 CD82"            /* Aïsñ@çsà◊Ç‹ÇΩÇÕÇ */
	$"BB82 CC91 BC29 2082 C982 E682 E982 E082"            /* ªÇÃëº) Ç…ÇÊÇÈÇ‡Ç */
	$"CC82 C582 A082 E982 A982 F096 E282 A282"            /* ÃÇ≈Ç†ÇÈÇ©Çñ‚Ç¢Ç */
	$"DC82 B982 F181 4296 7B8C 5F96 F182 C98A"            /* ‹ÇπÇÒÅBñ{å_ñÒÇ…ä */
	$"EE82 C382 AD20 4D6F 7A69 6C6C 6120 834F"            /* ÓÇ√Ç≠ Mozilla ÉO */
	$"838B 815B 8376 82CC 90D3 9443 82CC 918D"            /* ÉãÅ[ÉvÇÃê”îCÇÃëç */
	$"8A7A 82CD 8141 3530 3020 8368 838B 8141"            /* äzÇÕÅA500 ÉhÉãÅA */
	$"82DC 82BD 82CD 82B1 82CC 8389 8343 835A"            /* Ç‹ÇΩÇÕÇ±ÇÃÉâÉCÉZ */
	$"8393 8358 82C9 8AEE 82C3 82AB 8347 8393"            /* ÉìÉXÇ…äÓÇ√Ç´ÉGÉì */
	$"8368 8386 815B 8355 82AA 8E78 95A5 82C1"            /* ÉhÉÜÅ[ÉUÇ™éxï•Ç¡ */
	$"82BD 97BF 8BE0 2028 97BF 8BE0 82AA 94AD"            /* ÇΩóøã‡ (óøã‡Ç™î≠ */
	$"90B6 82B5 82BD 8FEA 8D87 2920 82CC 82A2"            /* ê∂ÇµÇΩèÍçá) ÇÃÇ¢ */
	$"82B8 82EA 82A9 91E5 82AB 82A2 82D9 82A4"            /* Ç∏ÇÍÇ©ëÂÇ´Ç¢ÇŸÇ§ */
	$"82CC 8BE0 8A7A 82F0 8FE3 8CC0 82C6 82B5"            /* ÇÃã‡äzÇè„å¿Ç∆Çµ */
	$"82DC 82B7 8142 8D91 82E2 926E 88E6 82C9"            /* Ç‹Ç∑ÅBçëÇ‚ínàÊÇ… */
	$"82E6 82C1 82C4 82CD 9574 908F 9349 91B9"            /* ÇÊÇ¡ÇƒÇÕïtêèìIëπ */
	$"8A51 8141 9468 90B6 9349 91B9 8A51 8141"            /* äQÅAîhê∂ìIëπäQÅA */
	$"82DC 82BD 82CD 93C1 95CA 91B9 8A51 82CC"            /* Ç‹ÇΩÇÕì¡ï ëπäQÇÃ */
	$"8F9C 8A4F 82DC 82BD 82CD 90A7 8CC0 82AA"            /* èúäOÇ‹ÇΩÇÕêßå¿Ç™ */
	$"9640 97A5 8FE3 9446 82DF 82E7 82EA 82C8"            /* ñ@ó•è„îFÇﬂÇÁÇÍÇ» */
	$"82A2 8FEA 8D87 82AA 82A0 82E8 82DC 82B7"            /* Ç¢èÍçáÇ™Ç†ÇËÇ‹Ç∑ */
	$"82AA 8141 82BB 82CC 8FEA 8D87 82C9 82CD"            /* Ç™ÅAÇªÇÃèÍçáÇ…ÇÕ */
	$"82B1 82CC 8FF0 8D80 82CD 934B 9770 82B3"            /* Ç±ÇÃèçÄÇÕìKópÇ≥ */
	$"82EA 82DC 82B9 82F1 8142 0D0D 362E 2097"            /* ÇÍÇ‹ÇπÇÒÅB..6. ó */
	$"418F 6F8B 4B91 A50D 82B1 82CC 8389 8343"            /* AèoãKë•.Ç±ÇÃÉâÉC */
	$"835A 8393 8358 82C9 82CD 8141 8A59 9396"            /* ÉZÉìÉXÇ…ÇÕÅAäYìñ */
	$"82B7 82E9 82B7 82D7 82C4 82CC 9741 8F6F"            /* Ç∑ÇÈÇ∑Ç◊ÇƒÇÃóAèo */
	$"8B4B 90A7 82AA 934B 9770 82B3 82EA 82DC"            /* ãKêßÇ™ìKópÇ≥ÇÍÇ‹ */
	$"82B7 8142 8347 8393 8368 8386 815B 8355"            /* Ç∑ÅBÉGÉìÉhÉÜÅ[ÉU */
	$"82CD 8141 967B 90BB 9569 82A8 82E6 82D1"            /* ÇÕÅAñ{êªïiÇ®ÇÊÇ— */
	$"82BB 82CC 8E67 9770 82C9 8AD6 82B7 82E9"            /* ÇªÇÃégópÇ…ä÷Ç∑ÇÈ */
	$"95C4 8D91 82DC 82BD 82CD 82BB 82CC 91BC"            /* ïƒçëÇ‹ÇΩÇÕÇªÇÃëº */
	$"82CC 90AD 957B 8B40 8AD6 82C9 82E6 82E9"            /* ÇÃê≠ï{ã@ä÷Ç…ÇÊÇÈ */
	$"9741 8F6F 93FC 82CC 9640 97A5 82C8 82E7"            /* óAèoì¸ÇÃñ@ó•Ç»ÇÁ */
	$"82D1 82C9 8B4B 90A7 82A8 82E6 82D1 8B4B"            /* Ç—Ç…ãKêßÇ®ÇÊÇ—ãK */
	$"91A5 82C9 8F5D 82ED 82C8 82AF 82EA 82CE"            /* ë•Ç…è]ÇÌÇ»ÇØÇÍÇŒ */
	$"82C8 82E8 82DC 82B9 82F1 8142 0D0D 372E"            /* Ç»ÇËÇ‹ÇπÇÒÅB..7. */
	$"2095 C48D 9190 AD95 7B8B 408A D683 4783"            /*  ïƒçëê≠ï{ã@ä÷ÉGÉ */
	$"9383 6883 8681 5B83 550D 967B 90BB 9569"            /* ìÉhÉÜÅ[ÉU.ñ{êªïi */
	$"82CD 8141 3438 2043 2E46 2E52 2E20 3132"            /* ÇÕÅA48 C.F.R. 12 */
	$"2E32 3132 2028 3139 3935 2094 4E20 3920"            /* .212 (1995 îN 9  */
	$"8C8E 2920 82A8 82E6 82D1 2034 3820 432E"            /* åé) Ç®ÇÊÇ— 48 C. */
	$"462E 522E 2032 3237 2E37 3230 3220 2831"            /* F.R. 227.7202 (1 */
	$"3939 3520 944E 2036 208C 8E29 2082 CC92"            /* 995 îN 6 åé) ÇÃí */
	$"E88B 6082 C982 E682 E981 758F A497 7083"            /* Ëã`Ç…ÇÊÇÈÅuè§ópÉ */
	$"5283 9383 7383 8581 5B83 5E83 5C83 7483"            /* RÉìÉsÉÖÅ[É^É\ÉtÉ */
	$"6783 4583 4683 4120 2863 6F6D 6D65 7263"            /* gÉEÉFÉA (commerc */
	$"6961 6C20 636F 6D70 7574 6572 2073 6F66"            /* ial computer sof */
	$"7477 6172 6529 8176 82A8 82E6 82D1 8175"            /* tware)ÅvÇ®ÇÊÇ—Åu */
	$"8FA4 9770 8352 8393 8373 8385 815B 835E"            /* è§ópÉRÉìÉsÉÖÅ[É^ */
	$"835C 8374 8367 8345 8346 8341 95B6 8F91"            /* É\ÉtÉgÉEÉFÉAï∂èë */
	$"2028 636F 6D6D 6572 6369 616C 2063 6F6D"            /*  (commercial com */
	$"7075 7465 7220 736F 6674 7761 7265 2064"            /* puter software d */
	$"6F63 756D 656E 7461 7469 6F6E 2981 7682"            /* ocumentation)ÅvÇ */
	$"C58D 5C90 AC82 B382 EA82 E981 4134 3820"            /* ≈ç\ê¨Ç≥ÇÍÇÈÅA48  */
	$"432E 462E 522E 2032 2E31 3031 2028 3139"            /* C.F.R. 2.101 (19 */
	$"3935 2094 4E20 3130 208C 8E29 2082 CC92"            /* 95 îN 10 åé) ÇÃí */
	$"E88B 6082 C982 E682 E981 758F A495 6920"            /* Ëã`Ç…ÇÊÇÈÅuè§ïi  */
	$"2863 6F6D 6D65 7263 6961 6C20 6974 656D"            /* (commercial item */
	$"2981 7682 C582 B781 4234 3820 432E 462E"            /* )ÅvÇ≈Ç∑ÅB48 C.F. */
	$"522E 2031 322E 3231 3281 4134 3820 432E"            /* R. 12.212ÅA48 C. */
	$"462E 522E 2032 372E 3430 3528 6229 2832"            /* F.R. 27.405(b)(2 */
	$"2920 2831 3939 3820 944E 2036 208C 8E29"            /* ) (1998 îN 6 åé) */
	$"8141 82A8 82E6 82D1 2034 3820 432E 462E"            /* ÅAÇ®ÇÊÇ— 48 C.F. */
	$"522E 2032 3237 2E37 3230 3220 82C5 92E8"            /* R. 227.7202 Ç≈íË */
	$"82DF 82E7 82EA 82C4 82A2 82E9 82C6 82A8"            /* ÇﬂÇÁÇÍÇƒÇ¢ÇÈÇ∆Ç® */
	$"82E8 8141 82B7 82D7 82C4 82CC 95C4 8D91"            /* ÇËÅAÇ∑Ç◊ÇƒÇÃïƒçë */
	$"90AD 957B 8B40 8AD6 8347 8393 8368 8386"            /* ê≠ï{ã@ä÷ÉGÉìÉhÉÜ */
	$"815B 8355 82CD 8141 967B 90BB 9569 82C9"            /* Å[ÉUÇÕÅAñ{êªïiÇ… */
	$"82C2 82AB 967B 8C5F 96F1 82C9 8B4C 8DDA"            /* Ç¬Ç´ñ{å_ñÒÇ…ãLç⁄ */
	$"82B3 82EA 82BD 8CA0 9798 82CC 82DD 82F0"            /* Ç≥ÇÍÇΩå†óòÇÃÇ›Ç */
	$"8EE6 93BE 82B5 82DC 82B7 8142 0D0D 382E"            /* éÊìæÇµÇ‹Ç∑ÅB..8. */
	$"2082 BB82 CC91 BC0D 2861 2920 967B 8C5F"            /*  ÇªÇÃëº.(a) ñ{å_ */
	$"96F1 82CD 8141 967B 8C5F 96F1 82CC 8EE5"            /* ñÒÇÕÅAñ{å_ñÒÇÃéÂ */
	$"91E8 82C9 8AD6 82B7 82E9 204D 6F7A 696C"            /* ëËÇ…ä÷Ç∑ÇÈ Mozil */
	$"6C61 2082 C683 4783 9383 6883 8681 5B83"            /* la Ç∆ÉGÉìÉhÉÜÅ[É */
	$"5582 CC8A D482 CC8D 8788 D393 E097 6582"            /* UÇÃä‘ÇÃçáà”ì‡óeÇ */
	$"CC82 B782 D782 C482 C582 A082 E881 414D"            /* ÃÇ∑Ç◊ÇƒÇ≈Ç†ÇËÅAM */
	$"6F7A 696C 6C61 2082 CC90 B393 9682 C88C"            /* ozilla ÇÃê≥ìñÇ»å */
	$"A08C C082 F097 5E82 A682 E782 EA82 BD91"            /* †å¿Çó^Ç¶ÇÁÇÍÇΩë */
	$"E395 5C8E D282 AA8F 9096 BC82 B582 BD95"            /* „ï\é“Ç™èêñºÇµÇΩï */
	$"B68F 9182 C982 E682 C182 C482 CC82 DD95"            /* ∂èëÇ…ÇÊÇ¡ÇƒÇÃÇ›ï */
	$"CF8D 5882 C582 AB82 DC82 B781 4228 6229"            /* œçXÇ≈Ç´Ç‹Ç∑ÅB(b) */
	$"2093 4B97 7082 B382 EA82 E996 4082 C988"            /*  ìKópÇ≥ÇÍÇÈñ@Ç…à */
	$"D982 C882 E992 E882 DF82 AA82 A082 E98F"            /* ŸÇ»ÇÈíËÇﬂÇ™Ç†ÇÈè */
	$"EA8D 8782 F08F 9C82 AB81 4196 7B8C 5F96"            /* ÍçáÇèúÇ´ÅAñ{å_ñ */
	$"F182 CD81 4196 4082 CC92 EF90 4782 C98A"            /* ÒÇÕÅAñ@ÇÃíÔêGÇ…ä */
	$"D682 B782 E98B 4B92 E882 F08F 9C82 A282"            /* ÷Ç∑ÇÈãKíËÇèúÇ¢Ç */
	$"C495 C48D 9183 4A83 8A83 7483 4883 8B83"            /* ƒïƒçëÉJÉäÉtÉHÉãÉ */
	$"6A83 418F 4296 4082 C98F 808B 9282 B782"            /* jÉAèBñ@Ç…èÄãíÇ∑Ç */
	$"E982 E082 CC82 C682 B582 DC82 B781 4228"            /* ÈÇ‡ÇÃÇ∆ÇµÇ‹Ç∑ÅB( */
	$"6329 2096 7B8C 5F96 F182 CD81 418D 918D"            /* c) ñ{å_ñÒÇÕÅAçëç */
	$"DB95 A895 6994 8494 838C 5F96 F182 C98A"            /* €ï®ïiîÑîÉå_ñÒÇ…ä */
	$"D682 B782 E98D 9198 418F F096 F120 2855"            /* ÷Ç∑ÇÈçëòAèñÒ (U */
	$"6E69 7465 6420 4E61 7469 6F6E 7320 436F"            /* nited Nations Co */
	$"6E76 656E 7469 6F6E 206F 6E20 436F 6E74"            /* nvention on Cont */
	$"7261 6374 7320 666F 7220 7468 6520 496E"            /* racts for the In */
	$"7465 726E 6174 696F 6E61 6C20 5361 6C65"            /* ternational Sale */
	$"206F 6620 476F 6F64 7329 2082 CC93 4B97"            /*  of Goods) ÇÃìKó */
	$"7082 CD8E F382 AF82 C882 A282 E082 CC82"            /* pÇÕéÛÇØÇ»Ç¢Ç‡ÇÃÇ */
	$"C682 B582 DC82 B781 4228 6429 2096 7B8C"            /* ∆ÇµÇ‹Ç∑ÅB(d) ñ{å */
	$"5F96 F182 CC88 EA95 9482 AA96 B38C F882"            /* _ñÒÇÃàÍïîÇ™ñ≥å¯Ç */
	$"DC82 BD82 CD8E B78D 7395 7394 5C82 C694"            /* ‹ÇΩÇÕé∑çsïsî\Ç∆î */
	$"BB92 6682 B382 EA82 BD8F EA8D 8782 C582"            /* ªífÇ≥ÇÍÇΩèÍçáÇ≈Ç */
	$"E081 4182 BB82 CC95 9495 AA82 CD97 BC93"            /* ‡ÅAÇªÇÃïîï™ÇÕóºì */
	$"968E 968E D282 CC96 7B97 8882 CC88 D390"            /* ñéñé“ÇÃñ{óàÇÃà”ê */
	$"7D82 C989 8882 C182 C489 F08E DF82 B382"            /* }Ç…âàÇ¡ÇƒâéﬂÇ≥Ç */
	$"EA82 E982 E082 CC82 C682 B581 418E 6382"            /* ÍÇÈÇ‡ÇÃÇ∆ÇµÅAécÇ */
	$"E882 CC95 9495 AA82 CD88 F882 AB91 B182"            /* ËÇÃïîï™ÇÕà¯Ç´ë±Ç */
	$"AB97 4C8C F882 C991 B691 B182 B782 E982"            /* ´óLå¯Ç…ë∂ë±Ç∑ÇÈÇ */
	$"E082 CC82 C682 B582 DC82 B781 4228 6529"            /* ‡ÇÃÇ∆ÇµÇ‹Ç∑ÅB(e) */
	$"2088 EA95 FB93 968E 968E D282 AA96 7B8C"            /*  àÍï˚ìñéñé“Ç™ñ{å */
	$"5F96 F182 CC8F F08C 8F82 DC82 BD82 CD82"            /* _ñÒÇÃèåèÇ‹ÇΩÇÕÇ */
	$"BB82 CC88 E194 BD82 C991 CE82 B782 E98C"            /* ªÇÃà·îΩÇ…ëŒÇ∑ÇÈå */
	$"A097 9882 F031 9378 95FA 8AFC 82B5 82BD"            /* †óòÇ1ìxï˙ä¸ÇµÇΩ */
	$"8FEA 8D87 82C5 82E0 8141 82BB 82CC 8FF0"            /* èÍçáÇ≈Ç‡ÅAÇªÇÃè */
	$"8C8F 82DC 82BD 82CD 82BB 82CC 8CE3 82CC"            /* åèÇ‹ÇΩÇÕÇªÇÃå„ÇÃ */
	$"88E1 94BD 82C9 91CE 82B7 82E9 8CA0 9798"            /* à·îΩÇ…ëŒÇ∑ÇÈå†óò */
	$"82F0 95FA 8AFC 82B5 82BD 82B1 82C6 82C9"            /* Çï˙ä¸ÇµÇΩÇ±Ç∆Ç… */
	$"82CD 82C8 82E7 82C8 82A2 82E0 82CC 82C6"            /* ÇÕÇ»ÇÁÇ»Ç¢Ç‡ÇÃÇ∆ */
	$"82B5 82DC 82B7 8142 2866 2920 9640 82CC"            /* ÇµÇ‹Ç∑ÅB(f) ñ@ÇÃ */
	$"92E8 82DF 82C9 82E6 82E9 8FEA 8D87 82F0"            /* íËÇﬂÇ…ÇÊÇÈèÍçáÇ */
	$"8F9C 82AB 8141 967B 8C5F 96F1 82C5 82CD"            /* èúÇ´ÅAñ{å_ñÒÇ≈ÇÕ */
	$"8970 8CEA 82AA 82D9 82A9 82CC 82B7 82D7"            /* âpåÍÇ™ÇŸÇ©ÇÃÇ∑Ç◊ */
	$"82C4 82CC 8CBE 8CEA 82C9 9744 90E6 82B7"            /* ÇƒÇÃåæåÍÇ…óDêÊÇ∑ */
	$"82E9 82E0 82CC 82C6 82B5 82DC 82B7 8142"            /* ÇÈÇ‡ÇÃÇ∆ÇµÇ‹Ç∑ÅB */
	$"2867 2920 8347 8393 8368 8386 815B 8355"            /* (g) ÉGÉìÉhÉÜÅ[ÉU */
	$"82CD 8141 967B 8C5F 96F1 8FE3 82CC 8CA0"            /* ÇÕÅAñ{å_ñÒè„ÇÃå† */
	$"9798 82F0 8141 967B 8C5F 96F1 82CC 8FF0"            /* óòÇÅAñ{å_ñÒÇÃè */
	$"8C8F 82C9 8D53 91A9 82B3 82EA 82E9 82B1"            /* åèÇ…çSë©Ç≥ÇÍÇÈÇ± */
	$"82C6 82C9 93AF 88D3 82B7 82E9 91E6 8E4F"            /* Ç∆Ç…ìØà”Ç∑ÇÈëÊéO */
	$"8ED2 82C9 8FF7 936E 82B7 82E9 82B1 82C6"            /* é“Ç…è˜ìnÇ∑ÇÈÇ±Ç∆ */
	$"82AA 82C5 82AB 82DC 82B7 8142 4D6F 7A69"            /* Ç™Ç≈Ç´Ç‹Ç∑ÅBMozi */
	$"6C6C 6120 466F 756E 6461 7469 6F6E 2082"            /* lla Foundation Ç */
	$"CD81 4196 7B8C 5F96 F18F E382 CC8C A097"            /* ÕÅAñ{å_ñÒè„ÇÃå†ó */
	$"9882 F096 B38F F08C 8F82 C98F F793 6E82"            /* òÇñ≥èåèÇ…è˜ìnÇ */
	$"B782 E982 B182 C682 AA82 C582 AB82 DC82"            /* ∑ÇÈÇ±Ç∆Ç™Ç≈Ç´Ç‹Ç */
	$"B781 4228 6829 2096 7B8C 5F96 F182 CD81"            /* ∑ÅB(h) ñ{å_ñÒÇÕÅ */
	$"4197 BC93 968E 968E D281 4182 BB82 CC8F"            /* Aóºìñéñé“ÅAÇªÇÃè */
	$"B38C 708E D281 4182 A882 E682 D18B 9689"            /* ≥åpé“ÅAÇ®ÇÊÇ—ãñâ */
	$"C282 B382 EA82 BD8F F78E F390 6C82 F08D"            /* ¬Ç≥ÇÍÇΩè˜éÛêlÇç */
	$"5391 A982 B581 4182 DC82 BD97 BC93 968E"            /* Së©ÇµÅAÇ‹ÇΩóºìñé */
	$"968E D281 4182 BB82 CC8F B38C 708E D281"            /* ñé“ÅAÇªÇÃè≥åpé“Å */
	$"4182 A882 E682 D18B 9689 C282 B382 EA82"            /* AÇ®ÇÊÇ—ãñâ¬Ç≥ÇÍÇ */
	$"BD8F F78E F390 6C82 CC97 9889 7682 C98B"            /* Ωè˜éÛêlÇÃóòâvÇ…ã */
	$"4182 B782 E982 E082 CC82 C682 B582 DC82"            /* AÇ∑ÇÈÇ‡ÇÃÇ∆ÇµÇ‹Ç */
	$"B781 42"                                            /* ∑ÅB */
};

data 'styl' (5005, "Japanese SLA") {
	$"009E 0000 0000 0012 000B 84C1 0090 000C"            /* .û........Ñ¡.ê.. */
	$"0000 0000 0000 0000 00D2 000F 000C 0400"            /* .........“...... */
	$"0090 000C 0000 0000 0000 0000 00E6 000F"            /* .ê...........Ê.. */
	$"000C 0400 0190 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"00ED 0012 000B 8461 0090 000C 0000 0000"            /* .Ì....Ña.ê...... */
	$"0000 0000 0113 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 0114 0012 000B 84C1"            /* ..............Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 011E 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"012B 0012 000B 84C1 0090 000C 0000 0000"            /* .+....Ñ¡.ê...... */
	$"0000 0000 0163 000F 000C 0400 0090 000C"            /* .....c.......ê.. */
	$"0000 0000 0000 0000 0174 0012 000B 84C1"            /* .........t....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 01E4 000F"            /* .ê...........‰.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"01FC 0012 000B 84C1 0090 000C 0000 0000"            /* .¸....Ñ¡.ê...... */
	$"0000 0000 022E 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 022F 0012 000B 84C1"            /* ........./....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 0267 000F"            /* .ê...........g.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"026F 0012 000B 84C1 0090 000C 0000 0000"            /* .o....Ñ¡.ê...... */
	$"0000 0000 0297 000F 000C 0400 0090 000C"            /* .....ó.......ê.. */
	$"0000 0000 0000 0000 0299 0012 000B 84C1"            /* .........ô....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 02A3 000F"            /* .ê...........£.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"02A5 0012 000B 84C1 0090 000C 0000 0000"            /* .•....Ñ¡.ê...... */
	$"0000 0000 02AD 000F 000C 0400 0090 000C"            /* .....≠.......ê.. */
	$"0000 0000 0000 0000 02B5 0012 000B 84C1"            /* .........µ....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 02D7 000F"            /* .ê...........◊.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"02D9 0012 000B 84C1 0090 000C 0000 0000"            /* .Ÿ....Ñ¡.ê...... */
	$"0000 0000 02E3 000F 000C 0400 0090 000C"            /* .....„.......ê.. */
	$"0000 0000 0000 0000 02E5 0012 000B 84C1"            /* .........Â....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 031D 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0326 0012 000B 84C1 0090 000C 0000 0000"            /* .&....Ñ¡.ê...... */
	$"0000 0000 0340 000F 000C 0400 0090 000C"            /* .....@.......ê.. */
	$"0000 0000 0000 0000 0348 0012 000B 84C1"            /* .........H....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 03D0 000F"            /* .ê...........–.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"03D9 0012 000B 84C1 0090 000C 0000 0000"            /* .Ÿ....Ñ¡.ê...... */
	$"0000 0000 03F3 000F 000C 0400 0090 000C"            /* .....Û.......ê.. */
	$"0000 0000 0000 0000 03FA 0012 000B 84C1"            /* .........˙....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 043C 000F"            /* .ê...........<.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0443 0012 000B 84C1 0090 000C 0000 0000"            /* .C....Ñ¡.ê...... */
	$"0000 0000 0549 000F 000C 0400 0090 000C"            /* .....I.......ê.. */
	$"0000 0000 0000 0000 054C 0012 000B 84C1"            /* .........L....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 055D 000F"            /* .ê...........].. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0570 0012 000B 84C1 0090 000C 0000 0000"            /* .p....Ñ¡.ê...... */
	$"0000 0000 05E2 000F 000C 0400 0090 000C"            /* .....‚.......ê.. */
	$"0000 0000 0000 0000 05EA 0012 000B 84C1"            /* .........Í....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 06DC 000F"            /* .ê...........‹.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"06DF 0012 000B 84C1 0090 000C 0000 0000"            /* .ﬂ....Ñ¡.ê...... */
	$"0000 0000 0770 000F 000C 0400 0090 000C"            /* .....p.......ê.. */
	$"0000 0000 0000 0000 0772 0012 000B 84C1"            /* .........r....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 0774 000F"            /* .ê...........t.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0777 0012 000B 84C1 0090 000C 0000 0000"            /* .w....Ñ¡.ê...... */
	$"0000 0000 0779 000F 000C 0400 0090 000C"            /* .....y.......ê.. */
	$"0000 0000 0000 0000 077B 0012 000B 84C1"            /* .........{....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 080B 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"080E 0012 000B 84C1 0090 000C 0000 0000"            /* ......Ñ¡.ê...... */
	$"0000 0000 0837 000F 000C 0400 0090 000C"            /* .....7.......ê.. */
	$"0000 0000 0000 0000 084E 0012 000B 84C1"            /* .........N....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 0874 000F"            /* .ê...........t.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0876 0012 000B 84C1 0090 000C 0000 0000"            /* .v....Ñ¡.ê...... */
	$"0000 0000 089A 000F 000C 0400 0090 000C"            /* .....ö.......ê.. */
	$"0000 0000 0000 0000 089C 0012 000B 84C1"            /* .........ú....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 08AC 000F"            /* .ê...........¨.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"08C4 0012 000B 84C1 0090 000C 0000 0000"            /* .ƒ....Ñ¡.ê...... */
	$"0000 0000 094C 000F 000C 0400 0090 000C"            /* ....∆L.......ê.. */
	$"0000 0000 0000 0000 0954 0012 000B 84C1"            /* ........∆T....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 0A6C 000F"            /* .ê..........¬l.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0A74 0012 000B 84C1 0090 000C 0000 0000"            /* ¬t....Ñ¡.ê...... */
	$"0000 0000 0ADA 000F 000C 0400 0090 000C"            /* ....¬⁄.......ê.. */
	$"0000 0000 0000 0000 0ADD 0012 000B 84C1"            /* ........¬›....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 0B42 000F"            /* .ê...........B.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0B4A 0012 000B 84C1 0090 000C 0000 0000"            /* .J....Ñ¡.ê...... */
	$"0000 0000 0B52 000F 000C 0400 0090 000C"            /* .....R.......ê.. */
	$"0000 0000 0000 0000 0B5B 0012 000B 84C1"            /* .........[....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 0D97 000F"            /* .ê...........ó.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0D9A 0012 000B 84C1 0090 000C 0000 0000"            /* .ö....Ñ¡.ê...... */
	$"0000 0000 0DBF 000F 000C 0400 0090 000C"            /* .....ø.......ê.. */
	$"0000 0000 0000 0000 0DC7 0012 000B 84C1"            /* .........«....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 0E0D 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0E0F 0012 000B 84C1 0090 000C 0000 0000"            /* ......Ñ¡.ê...... */
	$"0000 0000 0E19 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 0E21 0012 000B 84C1"            /* .........!....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 0E2B 000F"            /* .ê...........+.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0E2D 0012 000B 84C1 0090 000C 0000 0000"            /* .-....Ñ¡.ê...... */
	$"0000 0000 0FF9 000F 000C 0400 0090 000C"            /* .....˘.......ê.. */
	$"0000 0000 0000 0000 0FFB 0012 000B 84C1"            /* .........˚....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 1015 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1017 0012 000B 84C1 0090 000C 0000 0000"            /* ......Ñ¡.ê...... */
	$"0000 0000 1045 000F 000C 0400 0090 000C"            /* .....E.......ê.. */
	$"0000 0000 0000 0000 104E 0012 000B 84C1"            /* .........N....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 1066 000F"            /* .ê...........f.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"106A 0012 000B 84C1 0090 000C 0000 0000"            /* .j....Ñ¡.ê...... */
	$"0000 0000 10A6 000F 000C 0400 0090 000C"            /* .....¶.......ê.. */
	$"0000 0000 0000 0000 10A8 0012 000B 84C1"            /* .........®....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 10BA 000F"            /* .ê...........∫.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"10BC 0012 000B 84C1 0090 000C 0000 0000"            /* .º....Ñ¡.ê...... */
	$"0000 0000 117C 000F 000C 0400 0090 000C"            /* .....|.......ê.. */
	$"0000 0000 0000 0000 117F 0012 000B 84C1"            /* ..............Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 124E 000F"            /* .ê...........N.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1251 0012 000B 84C1 0090 000C 0000 0000"            /* .Q....Ñ¡.ê...... */
	$"0000 0000 1274 000F 000C 0400 0090 000C"            /* .....t.......ê.. */
	$"0000 0000 0000 0000 128B 0012 000B 84C1"            /* .........ã....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 128D 000F"            /* .ê...........ç.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1290 0012 000B 84C1 0090 000C 0000 0000"            /* .ê....Ñ¡.ê...... */
	$"0000 0000 1292 000F 000C 0400 0090 000C"            /* .....í.......ê.. */
	$"0000 0000 0000 0000 1294 0012 000B 84C1"            /* .........î....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 129A 000F"            /* .ê...........ö.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"12B4 0012 000B 84C1 0090 000C 0000 0000"            /* .¥....Ñ¡.ê...... */
	$"0000 0000 12B6 000F 000C 0400 0090 000C"            /* .....∂.......ê.. */
	$"0000 0000 0000 0000 12B9 0012 000B 84C1"            /* .........π....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 12BB 000F"            /* .ê...........ª.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"12BD 0012 000B 84C1 0090 000C 0000 0000"            /* .Ω....Ñ¡.ê...... */
	$"0000 0000 12E7 000F 000C 0400 0090 000C"            /* .....Á.......ê.. */
	$"0000 0000 0000 0000 1306 0012 000B 84C1"            /* ..............Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 1330 000F"            /* .ê...........0.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"135D 0012 000B 84C1 0090 000C 0000 0000"            /* .]....Ñ¡.ê...... */
	$"0000 0000 136D 000F 000C 0400 0090 000C"            /* .....m.......ê.. */
	$"0000 0000 0000 0000 1383 0012 000B 84C1"            /* .........É....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 1385 000F"            /* .ê...........Ö.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1389 0012 000B 84C1 0090 000C 0000 0000"            /* .â....Ñ¡.ê...... */
	$"0000 0000 138B 000F 000C 0400 0090 000C"            /* .....ã.......ê.. */
	$"0000 0000 0000 0000 138D 0012 000B 84C1"            /* .........ç....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 139F 000F"            /* .ê...........ü.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"13B1 0012 000B 84C1 0090 000C 0000 0000"            /* .±....Ñ¡.ê...... */
	$"0000 0000 13B9 000F 000C 0400 0090 000C"            /* .....π.......ê.. */
	$"0000 0000 0000 0000 13C9 0012 000B 84C1"            /* .........…....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 13CB 000F"            /* .ê...........À.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"13E8 0012 000B 84C1 0090 000C 0000 0000"            /* .Ë....Ñ¡.ê...... */
	$"0000 0000 13EA 000F 000C 0400 0090 000C"            /* .....Í.......ê.. */
	$"0000 0000 0000 0000 13ED 0012 000B 84C1"            /* .........Ì....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 13EF 000F"            /* .ê...........Ô.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"13F0 0012 000B 84C1 0090 000C 0000 0000"            /* .....Ñ¡.ê...... */
	$"0000 0000 13F8 000F 000C 0400 0090 000C"            /* .....¯.......ê.. */
	$"0000 0000 0000 0000 140C 0012 000B 84C1"            /* ..............Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 147E 000F"            /* .ê...........~.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1481 0012 000B 84C1 0090 000C 0000 0000"            /* .Å....Ñ¡.ê...... */
	$"0000 0000 1488 000F 000C 0400 0090 000C"            /* .....à.......ê.. */
	$"0000 0000 0000 0000 148C 0012 000B 84C1"            /* .........å....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 14AA 000F"            /* .ê...........™.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"14B3 0012 000B 84C1 0090 000C 0000 0000"            /* .≥....Ñ¡.ê...... */
	$"0000 0000 14DF 000F 000C 0400 0090 000C"            /* .....ﬂ.......ê.. */
	$"0000 0000 0000 0000 14E7 0012 000B 84C1"            /* .........Á....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 152D 000F"            /* .ê...........-.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1531 0012 000B 84C1 0090 000C 0000 0000"            /* .1....Ñ¡.ê...... */
	$"0000 0000 15AF 000F 000C 0400 0090 000C"            /* .....Ø.......ê.. */
	$"0000 0000 0000 0000 15B3 0012 000B 84C1"            /* .........≥....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 15DD 000F"            /* .ê...........›.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"162B 0012 000B 84C1 0090 000C 0000 0000"            /* .+....Ñ¡.ê...... */
	$"0000 0000 1649 000F 000C 0400 0090 000C"            /* .....I.......ê.. */
	$"0000 0000 0000 0000 164D 0012 000B 84C1"            /* .........M....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 16ED 000F"            /* .ê...........Ì.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"16F1 0012 000B 84C1 0090 000C 0000 0000"            /* .Ò....Ñ¡.ê...... */
	$"0000 0000 1725 000F 000C 0400 0090 000C"            /* .....%.......ê.. */
	$"0000 0000 0000 0000 1726 0012 000B 84C1"            /* .........&....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 1788 000F"            /* .ê...........à.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"178C 0012 000B 84C1 0090 000C 0000 0000"            /* .å....Ñ¡.ê...... */
	$"0000 0000 17E0 000F 000C 0400 0090 000C"            /* .....‡.......ê.. */
	$"0000 0000 0000 0000 17E4 0012 000B 84C1"            /* .........‰....Ñ¡ */
	$"0090 000C 0000 0000 0000 0000 184C 000F"            /* .ê...........L.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"185F 0012 000B 84C1 0090 000C 0000 0000"            /* ._....Ñ¡.ê...... */
	$"0000 0000 1893 000F 000C 0400 0090 000C"            /* .....ì.......ê.. */
	$"0000 0000 0000 0000 1897 0012 000B 84C1"            /* .........ó....Ñ¡ */
	$"0090 000C 0000 0000 0000"                           /* .ê........ */
};

data 'TEXT' (5006, "Korean SLA") {
	$"C0CC 20B9 AEBC ADB4 C220 4341 4D49 4E4F"            /* ¿Ã πÆº≠¥¬ CAMINO */
	$"20C3 D6C1 BEBB E7BF EBC0 DAB6 F3C0 CCBC"            /*  √÷¡æªÁøÎ¿⁄∂Û¿Ãº */
	$"BEBD BAB0 E8BE E0C0 BB20 C7D1 B1B9 BEEE"            /* æΩ∫∞Ëæ‡¿ª «—±πæÓ */
	$"20BE F0BE EEB7 CE20 B9F8 BFAA C7D1 20BA"            /*  ææÓ∑Œ π¯ø™«— ∫ */
	$"F1B0 F8BD C420 B9F8 BFAA BABB C0D4 B4CF"            /* Ò∞¯Ωƒ π¯ø™∫ª¿‘¥œ */
	$"B4D9 2E20 C0CC 20B9 AEBC ADBF A1BC ADB4"            /* ¥Ÿ. ¿Ã πÆº≠ø°º≠¥ */
	$"C220 BABB 2043 414D 494E 4F20 BBE7 BABB"            /* ¬ ∫ª CAMINO ªÁ∫ª */
	$"BFA1 20B4 EBC7 D120 B6F3 C0CC BCBE BDBA"            /* ø° ¥Î«— ∂Û¿ÃºæΩ∫ */
	$"20C1 B6B0 C7C0 BB20 B9FD C0FB 20C2 F7BF"            /*  ¡∂∞«¿ª π˝¿˚ ¬˜ø */
	$"F8BF A1BC AD20 B8ED BDC3 C7CF B0ED 20C0"            /* ¯ø°º≠ ∏ÌΩ√«œ∞Ì ¿ */
	$"D6C1 F620 BECA C0B8 B8E7 2C20 C3D6 C1BE"            /* ÷¡ˆ æ ¿∏∏Á, √÷¡æ */
	$"BBE7 BFEB C0DA 20B6 F3C0 CCBC BEBD BA20"            /* ªÁøÎ¿⁄ ∂Û¿ÃºæΩ∫  */
	$"B0E8 BEE0 C0C7 20C3 D6C3 CA20 BFB5 B9AE"            /* ∞Ëæ‡¿« √÷√  øµπÆ */
	$"20B9 F6C0 FC28 BEC6 B7A1 BFA1 20C6 F7C7"            /*  πˆ¿¸(æ∆∑°ø° ∆˜« */
	$"D4B5 C7BE EE20 C0D6 C0BD 29BF A1BC ADB8"            /* ‘µ«æÓ ¿÷¿Ω)ø°º≠∏ */
	$"B820 BBF3 B1E2 20B6 F3C0 CCBC BEBD BA20"            /* ∏ ªÛ±‚ ∂Û¿ÃºæΩ∫  */
	$"C1B6 B0C7 C0CC 20B8 EDBD C3B5 C7BE EE20"            /* ¡∂∞«¿Ã ∏ÌΩ√µ«æÓ  */
	$"C0D6 BDC0 B4CF B4D9 2E20 B1D7 B7AF B3AA"            /* ¿÷Ω¿¥œ¥Ÿ. ±◊∑Ø≥™ */
	$"2C20 BABB BBE7 B4C2 20C7 D1B1 B9BE EE20"            /* , ∫ªªÁ¥¬ «—±πæÓ  */
	$"BEF0 BEEE 20BB E7BF EBC0 DAB5 E9C0 CC20"            /* ææÓ ªÁøÎ¿⁄µÈ¿Ã  */
	$"BABB 20B9 F8BF AABA BBC0 BB20 C5EB C7D8"            /* ∫ª π¯ø™∫ª¿ª ≈Î«ÿ */
	$"2043 414D 494E 4F20 C3D6 C1BE 20BB E7BF"            /*  CAMINO √÷¡æ ªÁø */
	$"EBC0 DA20 B6F3 C0CC BCBE BDBA 20B0 E8BE"            /* Î¿⁄ ∂Û¿ÃºæΩ∫ ∞Ëæ */
	$"E0C0 BB20 BAB8 B4D9 20B4 F520 C0DF 20C0"            /* ‡¿ª ∫∏¥Ÿ ¥ı ¿ﬂ ¿ */
	$"CCC7 D8C7 D220 BCF6 20C0 D6B1 E2B8 A620"            /* Ã«ÿ«“ ºˆ ¿÷±‚∏¶  */
	$"B9D9 B6F8 B4CF B4D9 2E0D 0D43 414D 494E"            /* πŸ∂¯¥œ¥Ÿ...CAMIN */
	$"4F20 C3D6 C1BE 20BB E7BF EBC0 DA20 BCD2"            /* O √÷¡æ ªÁøÎ¿⁄ º“ */
	$"C7C1 C6AE BFFE BEEE 20B6 F3C0 CCBC BEBD"            /* «¡∆Æø˛æÓ ∂Û¿ÃºæΩ */
	$"BA20 B0E8 BEE0 0DB9 F6C0 FC20 312E 310D"            /* ∫ ∞Ëæ‡.πˆ¿¸ 1.1. */
	$"0DB1 CDC7 CFB0 A120 BBE7 BFEB 2C20 BAAF"            /* .±Õ«œ∞° ªÁøÎ, ∫Ø */
	$"B0E6 20B9 D720 B9E8 C6F7 C7D2 20BC F620"            /* ∞Ê π◊ πË∆˜«“ ºˆ  */
	$"C0D6 B4C2 20C6 AFC1 A420 4341 4D49 4E4F"            /* ¿÷¥¬ ∆Ø¡§ CAMINO */
	$"20BA EAB6 F3BF ECC0 FA20 B1E2 B4C9 C0C7"            /*  ∫Í∂ÛøÏ¿˙ ±‚¥…¿« */
	$"20BC D2BD BA20 C4DA B5E5 20B9 F6C0 FCC0"            /*  º“Ω∫ ƒ⁄µÂ πˆ¿¸¿ */
	$"BA20 4D4F 5A49 4C4C 4120 B0F8 B0B3 20B6"            /* ∫ MOZILLA ∞¯∞≥ ∂ */
	$"F3C0 CCBC BEBD BA20 B9D7 20BF A9C5 B820"            /* Û¿ÃºæΩ∫ π◊ ø©≈∏  */
	$"B0F8 B0B3 20BC D2BD BA20 BCD2 C7C1 C6AE"            /* ∞¯∞≥ º“Ω∫ º“«¡∆Æ */
	$"BFFE BEEE 20B6 F3C0 CCBC BEBD BABF A120"            /* ø˛æÓ ∂Û¿ÃºæΩ∫ø°  */
	$"B5FB B6F3 2057 5757 2E4D 4F5A 494C 4C41"            /* µ˚∂Û WWW.MOZILLA */
	$"2E4F 5247 BFA1 BCAD 20B9 ABB7 E1B7 CE20"            /* .ORGø°º≠ π´∑·∑Œ  */
	$"C1A6 B0F8 B5CB B4CF B4D9 2E0D 0DB5 BFBA"            /* ¡¶∞¯µÀ¥œ¥Ÿ...µø∫ */
	$"C0B5 C7B4 C220 4341 4D49 4E4F 20BD C7C7"            /* ¿µ«¥¬ CAMINO Ω«« */
	$"E020 C4DA B5E5 20B9 F6C0 FC20 B9D7 20B0"            /* ‡ ƒ⁄µÂ πˆ¿¸ π◊ ∞ */
	$"FCB7 C320 B9AE BCAD 28D2 C1A6 C7B0 D329"            /* ¸∑√ πÆº≠(“¡¶«∞”) */
	$"B4C2 20C0 CC20 4341 4D49 4E4F 20C3 D6C1"            /* ¥¬ ¿Ã CAMINO √÷¡ */
	$"BE20 BBE7 BFEB C0DA 20BC D2C7 C1C6 AEBF"            /* æ ªÁøÎ¿⁄ º“«¡∆Æø */
	$"FEBE EE20 B6F3 C0CC BCBE BDBA 20B0 E8BE"            /* ˛æÓ ∂Û¿ÃºæΩ∫ ∞Ëæ */
	$"E028 D2C0 CC20 B0E8 BEE0 D329 C0C7 20C1"            /* ‡(“¿Ã ∞Ëæ‡”)¿« ¡ */
	$"B6B0 C7BF A120 B5FB B6F3 20B1 CDC7 CFBF"            /* ∂∞«ø° µ˚∂Û ±Õ«œø */
	$"A1B0 D420 C1A6 B0F8 B5C7 B4C2 20B0 CDC0"            /* °∞‘ ¡¶∞¯µ«¥¬ ∞Õ¿ */
	$"D4B4 CFB4 D92E 20D2 B5BF C0C7 2841 4343"            /* ‘¥œ¥Ÿ. “µø¿«(ACC */
	$"4550 5429 D320 B9F6 C6B0 C0BB 20C5 ACB8"            /* EPT)” πˆ∆∞¿ª ≈¨∏ */
	$"AFC7 CFB0 C5B3 AA2C 2043 414D 494E 4F20"            /* Ø«œ∞≈≥™, CAMINO  */
	$"BAEA B6F3 BFEC C0FA B8A6 20BC B3C4 A120"            /* ∫Í∂ÛøÏ¿˙∏¶ º≥ƒ°  */
	$"B6C7 B4C2 20BB E7BF EBC7 D4C0 B8B7 CEBD"            /* ∂«¥¬ ªÁøÎ«‘¿∏∑ŒΩ */
	$"E12C 20B1 CDC7 CFB4 C220 C0CC 20B0 E8BE"            /* ·, ±Õ«œ¥¬ ¿Ã ∞Ëæ */
	$"E0C0 BB20 C1D8 BCF6 C7CF B4C2 20B0 CDBF"            /* ‡¿ª ¡ÿºˆ«œ¥¬ ∞Õø */
	$"A120 B5BF C0C7 C7CF B4C2 20B0 CDC0 D4B4"            /* ° µø¿««œ¥¬ ∞Õ¿‘¥ */
	$"CFB4 D92E 20B1 CDC7 CFB0 A120 C0CC 20B0"            /* œ¥Ÿ. ±Õ«œ∞° ¿Ã ∞ */
	$"E8BE E0C0 C720 C1B6 B0C7 BFA1 20B5 BFC0"            /* Ëæ‡¿« ¡∂∞«ø° µø¿ */
	$"C7C7 CFC1 F620 BECA C0BB 20B0 E6BF EC2C"            /* ««œ¡ˆ æ ¿ª ∞ÊøÏ, */
	$"20D2 B5BF C0C7 D320 B9F6 C6B0 C0BB 20C5"            /*  “µø¿«” πˆ∆∞¿ª ≈ */
	$"ACB8 AFC7 CFC1 F620 B8B6 BDC3 B0ED 2C20"            /* ¨∏Ø«œ¡ˆ ∏∂Ω√∞Ì,  */
	$"4341 4D49 4E4F 20BA EAB6 F3BF ECC0 FAC0"            /* CAMINO ∫Í∂ÛøÏ¿˙¿ */
	$"C720 C0CF BACE B5B5 20BC B3C4 A120 B6C7"            /* « ¿œ∫Œµµ º≥ƒ° ∂« */
	$"B4C2 20BB E7BF EBC7 CFC1 F620 B8B6 BDCA"            /* ¥¬ ªÁøÎ«œ¡ˆ ∏∂Ω  */
	$"BDC3 BFC0 2E20 4341 4D49 4E4F C0C7 20BC"            /* Ω√ø¿. CAMINO¿« º */
	$"B3C4 A120 C1DF 20B9 D720 B1D7 20C0 CCC8"            /* ≥ƒ° ¡ﬂ π◊ ±◊ ¿Ã» */
	$"C4BF A1B5 B520 B1CD C7CF B4C2 20C1 A633"            /* ƒø°µµ ±Õ«œ¥¬ ¡¶3 */
	$"20BC D2C7 C1C6 AEBF FEBE EE20 C1A6 B0F8"            /*  º“«¡∆Æø˛æÓ ¡¶∞¯ */
	$"BEF7 C3BC C0C7 20C3 DFB0 A120 B1B8 BCBA"            /* æ˜√º¿« √ﬂ∞° ±∏º∫ */
	$"20BF E4BC D2B8 A620 BCB3 C4A1 C7D2 20BC"            /*  ø‰º“∏¶ º≥ƒ°«“ º */
	$"F620 C0D6 BDC0 B4CF B4D9 2E20 C0CC B7AF"            /* ˆ ¿÷Ω¿¥œ¥Ÿ. ¿Ã∑Ø */
	$"C7D1 20C3 DFB0 A120 B1B8 BCBA 20BF E4BC"            /* «— √ﬂ∞° ±∏º∫ ø‰º */
	$"D2C0 C720 BCB3 C4A1 20B9 D720 BBE7 BFEB"            /* “¿« º≥ƒ° π◊ ªÁøÎ */
	$"C0BA 20C3 DFB0 A120 B6F3 C0CC BCBE BDBA"            /* ¿∫ √ﬂ∞° ∂Û¿ÃºæΩ∫ */
	$"20B0 E8BE E0C0 C720 C0FB BFEB C0BB 20B9"            /*  ∞Ëæ‡¿« ¿˚øÎ¿ª π */
	$"DEBD C0B4 CFB4 D92E 0D0D 312E 20B6 F3C0"            /* ﬁΩ¿¥œ¥Ÿ...1. ∂Û¿ */
	$"CCBC BEBD BA20 C7E3 BFA9 2E20 4D6F 7A69"            /* ÃºæΩ∫ «„ø©. Mozi */
	$"6C6C 6120 466F 756E 6461 7469 6F6E C0BA"            /* lla Foundation¿∫ */
	$"20C1 A6C7 B0C0 C720 BDC7 C7E0 B0A1 B4C9"            /*  ¡¶«∞¿« Ω««‡∞°¥… */
	$"20C4 DAB5 E520 B9F6 C0FC C0BB 20BB E7BF"            /*  ƒ⁄µÂ πˆ¿¸¿ª ªÁø */
	$"EBC7 D220 BCF6 20C0 D6B4 C220 BAF1 B5B6"            /* Î«“ ºˆ ¿÷¥¬ ∫Òµ∂ */
	$"C1A1 C0FB 20B6 F3C0 CCBC BEBD BAB8 A620"            /* ¡°¿˚ ∂Û¿ÃºæΩ∫∏¶  */
	$"B1CD C7CF BFA1 B0D4 20C7 E3BF A9C7 D5B4"            /* ±Õ«œø°∞‘ «„ø©«’¥ */
	$"CFB4 D92E 20C0 CC20 B0E8 BEE0 C0BA 20C3"            /* œ¥Ÿ. ¿Ã ∞Ëæ‡¿∫ √ */
	$"D6C3 CA20 C1A6 C7B0 C0BB 20B4 EBC3 BC20"            /* ÷√  ¡¶«∞¿ª ¥Î√º  */
	$"B9D7 2FB6 C7B4 C220 BAB8 BFCF C7CF B1E2"            /* π◊/∂«¥¬ ∫∏øœ«œ±‚ */
	$"20C0 A7C7 D820 4D6F 7A69 6C6C 61B0 A120"            /*  ¿ß«ÿ Mozilla∞°  */
	$"C1A6 B0F8 C7CF B4C2 20BC D2C7 C1C6 AEBF"            /* ¡¶∞¯«œ¥¬ º“«¡∆Æø */
	$"FEBE EE20 BEF7 B1D7 B7B9 C0CC B5E5 20B9"            /* ˛æÓ æ˜±◊∑π¿ÃµÂ π */
	$"F6C0 FCBF A1B5 B520 C0FB BFEB B5C7 C1F6"            /* ˆ¿¸ø°µµ ¿˚øÎµ«¡ˆ */
	$"B8B8 2C20 BBF3 B1E2 20BE F7B1 D7B7 B9C0"            /* ∏∏, ªÛ±‚ æ˜±◊∑π¿ */
	$"CCB5 E520 B9F6 C0FC BFA1 20BA B0B5 B5C0"            /* ÃµÂ πˆ¿¸ø° ∫∞µµ¿ */
	$"C720 B6F3 C0CC BCBE BDBA B0A1 20BC F6B9"            /* « ∂Û¿ÃºæΩ∫∞° ºˆπ */
	$"DDB5 C7B4 C220 B0E6 BFEC B4C2 20BF B9BF"            /* ›µ«¥¬ ∞ÊøÏ¥¬ øπø */
	$"DCB7 CE20 C7CF B8E7 2C20 C0CC B7AF C7D1"            /* ‹∑Œ «œ∏Á, ¿Ã∑Ø«— */
	$"20B0 E6BF ECBF A1B4 C220 C7D8 B4E7 20B6"            /*  ∞ÊøÏø°¥¬ «ÿ¥Á ∂ */
	$"F3C0 CCBC BEBD BAC0 C720 C1B6 B0C7 C0CC"            /* Û¿ÃºæΩ∫¿« ¡∂∞«¿Ã */
	$"20C0 FBBF EBB5 CBB4 CFB4 D92E 0D0D 322E"            /*  ¿˚øÎµÀ¥œ¥Ÿ...2. */
	$"20C7 D8C1 F62E 20B1 CDC7 CFB0 A120 C0CC"            /*  «ÿ¡ˆ. ±Õ«œ∞° ¿Ã */
	$"20B0 E8BE E0C0 BB20 C0A7 B9DD C7CF B4C2"            /*  ∞Ëæ‡¿ª ¿ßπ›«œ¥¬ */
	$"20B0 E6BF EC2C 20B1 CDC7 CFC0 C720 C1A6"            /*  ∞ÊøÏ, ±Õ«œ¿« ¡¶ */
	$"C7B0 20BB E7BF EBB1 C7C0 BA20 BEC6 B9AB"            /* «∞ ªÁøÎ±«¿∫ æ∆π´ */
	$"B7B1 20C5 EBC1 F6BE F8C0 CCB5 B520 C1EF"            /* ∑± ≈Î¡ˆæ¯¿Ãµµ ¡Ô */
	$"BDC3 20C7 D8C1 F6B5 C7B3 AA2C 20B6 F3C0"            /* Ω√ «ÿ¡ˆµ«≥™, ∂Û¿ */
	$"CCBC BEBD BA20 C7E3 BFA9 28C1 A631 C1B6"            /* ÃºæΩ∫ «„ø©(¡¶1¡∂ */
	$"29B8 A620 C1A6 BFDC C7D1 20C0 CC20 B0E8"            /* )∏¶ ¡¶ø‹«— ¿Ã ∞Ë */
	$"BEE0 C0C7 20B8 F0B5 E720 C1B6 C7D7 B5E9"            /* æ‡¿« ∏µÁ ¡∂«◊µÈ */
	$"C0BA 20C7 D8C1 F620 C0CC C8C4 BFA1 B5B5"            /* ¿∫ «ÿ¡ˆ ¿Ã»ƒø°µµ */
	$"20C1 B8BC D3C7 CFB0 ED20 C8BF B7C2 C0BB"            /*  ¡∏º”«œ∞Ì »ø∑¬¿ª */
	$"20C0 AFC1 F6C7 D5B4 CFB4 D92E 20C7 D8C1"            /*  ¿Ø¡ˆ«’¥œ¥Ÿ. «ÿ¡ */
	$"F6BD C32C 20B1 CDC7 CFB4 C220 C1A6 C7B0"            /* ˆΩ√, ±Õ«œ¥¬ ¡¶«∞ */
	$"C0C7 20B8 F0B5 E720 BBE7 BABB B5E9 C0BB"            /* ¿« ∏µÁ ªÁ∫ªµÈ¿ª */
	$"20C6 F3B1 E2C7 D8BE DF20 C7D5 B4CF B4D9"            /*  ∆Û±‚«ÿæﬂ «’¥œ¥Ÿ */
	$"2E0D 0D33 2E20 C0E7 BBEA B1C7 2E20 C1A6"            /* ...3. ¿ÁªÍ±«. ¡¶ */
	$"C7B0 C0C7 20C0 CFBA CEB4 C220 4D6F 7A69"            /* «∞¿« ¿œ∫Œ¥¬ Mozi */
	$"6C6C 6120 B0F8 B0B3 20B6 F3C0 CCBC BEBD"            /* lla ∞¯∞≥ ∂Û¿ÃºæΩ */
	$"BA20 B9D7 20BF A9C5 B820 B0F8 B0B3 20BC"            /* ∫ π◊ ø©≈∏ ∞¯∞≥ º */
	$"D2BD BA20 B6F3 C0CC BCBE BDBA 28C3 D1C4"            /* “Ω∫ ∂Û¿ÃºæΩ∫(√—ƒ */
	$"AAC7 CFBF A920 22B0 F8B0 B320 BCD2 BDBA"            /* ™«œø© "∞¯∞≥ º“Ω∫ */
	$"20B6 F3C0 CCBC BEBD BA22 29C0 C720 C1B6"            /*  ∂Û¿ÃºæΩ∫")¿« ¡∂ */
	$"B0C7 BFA1 20B5 FBB6 F320 BCD2 BDBA 20C4"            /* ∞«ø° µ˚∂Û º“Ω∫ ƒ */
	$"DAB5 E520 BEE7 BDC4 C0B8 B7CE 2068 7474"            /* ⁄µÂ æÁΩƒ¿∏∑Œ htt */
	$"703A 2F2F 7777 772E 6D6F 7A69 6C6C 612E"            /* p://www.mozilla. */
	$"6F72 67BF A1BC AD20 C1A6 B0F8 B5CB B4CF"            /* orgø°º≠ ¡¶∞¯µÀ¥œ */
	$"B4D9 2E20 C0CC 20B0 E8BE E0C0 C720 BEEE"            /* ¥Ÿ. ¿Ã ∞Ëæ‡¿« æÓ */
	$"B6B0 C7D1 20BB E7C7 D7B5 B520 B0F8 B0B3"            /* ∂∞«— ªÁ«◊µµ ∞¯∞≥ */
	$"20BC D2BD BA20 B6F3 C0CC BCBE BDBA BFA1"            /*  º“Ω∫ ∂Û¿ÃºæΩ∫ø° */
	$"20B5 FBB6 F320 C7E3 BFA9 B5C8 20B1 C7B8"            /*  µ˚∂Û «„ø©µ» ±«∏ */
	$"AEB8 A620 C1A6 C7D1 C7CF B4C2 20B0 CDC0"            /* Æ∏¶ ¡¶«—«œ¥¬ ∞Õ¿ */
	$"B8B7 CE20 C7D8 BCAE C7D2 20BC F620 BEF8"            /* ∏∑Œ «ÿºÆ«“ ºˆ æ¯ */
	$"BDC0 B4CF B4D9 2E20 C0FC BCFA 20BB E7C7"            /* Ω¿¥œ¥Ÿ. ¿¸º˙ ªÁ« */
	$"D7C0 BB20 C0FC C1A6 B7CE 20C7 CFBF A92C"            /* ◊¿ª ¿¸¡¶∑Œ «œø©, */
	$"204D 6F7A 696C 6C61 B4C2 20C0 CC20 B0E8"            /*  Mozilla¥¬ ¿Ã ∞Ë */
	$"BEE0 BFA1 BCAD 20B8 EDBD C3C0 FBC0 B8B7"            /* æ‡ø°º≠ ∏ÌΩ√¿˚¿∏∑ */
	$"CE20 C7E3 BFA9 C7D1 20B1 C7B8 AE20 C0CC"            /* Œ «„ø©«— ±«∏Æ ¿Ã */
	$"BFDC BFA1 20C1 A6C7 B0BF A120 B4EB C7D1"            /* ø‹ø° ¡¶«∞ø° ¥Î«— */
	$"20B8 F0B5 E720 C1F6 C0FB 20C0 E7BB EAB1"            /*  ∏µÁ ¡ˆ¿˚ ¿ÁªÍ± */
	$"C7C0 BB20 C1F7 C1A2 20B1 D7B8 AEB0 ED20"            /* «¿ª ¡˜¡¢ ±◊∏Æ∞Ì  */
	$"C0DA BDC5 C0C7 20B6 F3C0 CCBC BEBD BA20"            /* ¿⁄Ω≈¿« ∂Û¿ÃºæΩ∫  */
	$"C7E3 BFA9 C0DA B8A6 20B4 EBBD C5C7 CFBF"            /* «„ø©¿⁄∏¶ ¥ÎΩ≈«œø */
	$"A920 BAB8 C0AF C7D5 B4CF B4D9 2E20 B1CD"            /* © ∫∏¿Ø«’¥œ¥Ÿ. ±Õ */
	$"C7CF B4C2 20C1 A6C7 B0BF A120 B4EB C7D1"            /* «œ¥¬ ¡¶«∞ø° ¥Î«— */
	$"20B6 C7B4 C220 BABB B0C7 20BB F3C7 B0BF"            /*  ∂«¥¬ ∫ª∞« ªÛ«∞ø */
	$"A120 BACE C2F8 B5C8 20BB F3C7 A52C 20B7"            /* ° ∫Œ¬¯µ» ªÛ«•, ∑ */
	$"CEB0 ED2C 20C0 FAC0 DBB1 C720 B6C7 B4C2"            /* Œ∞Ì, ¿˙¿€±« ∂«¥¬ */
	$"20BF A9C5 B820 B5B6 C1A1 C0FB 20C5 EBC1"            /*  ø©≈∏ µ∂¡°¿˚ ≈Î¡ */
	$"F6B8 A620 C1A6 B0C5 20B6 C7B4 C220 BAAF"            /* ˆ∏¶ ¡¶∞≈ ∂«¥¬ ∫Ø */
	$"B0E6 C7D2 20BC F620 BEF8 BDC0 B4CF B4D9"            /* ∞Ê«“ ºˆ æ¯Ω¿¥œ¥Ÿ */
	$"2E20 C0CC 20B6 F3C0 CCBC BEBD BAB4 C220"            /* . ¿Ã ∂Û¿ÃºæΩ∫¥¬  */
	$"4D6F 7A69 6C6C 6120 B6C7 B4C2 204D 6F7A"            /* Mozilla ∂«¥¬ Moz */
	$"696C 6C61 C0C7 20B6 F3C0 CCBC BEBD BA20"            /* illa¿« ∂Û¿ÃºæΩ∫  */
	$"C7E3 BFA9 C0DA C0C7 20BB F3C7 A52C 20BC"            /* «„ø©¿⁄¿« ªÛ«•, º */
	$"ADBA F1BD BA20 B8B6 C5A9 20B6 C7B4 C220"            /* ≠∫ÒΩ∫ ∏∂≈© ∂«¥¬  */
	$"B7CE B0ED B8A6 20BB E7BF EBC7 D220 B1C7"            /* ∑Œ∞Ì∏¶ ªÁøÎ«“ ±« */
	$"B8AE B8A6 20B1 CDC7 CFBF A1B0 D420 C7E3"            /* ∏Æ∏¶ ±Õ«œø°∞‘ «„ */
	$"BFA9 C7CF C1F6 20BE CABD C0B4 CFB4 D92E"            /* ø©«œ¡ˆ æ Ω¿¥œ¥Ÿ. */
	$"0D0D 342E 20BA B8C1 F5C0 C720 BACE C0CE"            /* ..4. ∫∏¡ı¿« ∫Œ¿Œ */
	$"2E20 C1A6 C7B0 C0BA 20B8 F0B5 E720 B0E1"            /* . ¡¶«∞¿∫ ∏µÁ ∞· */
	$"C7D4 C0BB 20B0 AEB0 ED20 D2C0 D6B4 C220"            /* «‘¿ª ∞Æ∞Ì “¿÷¥¬  */
	$"B1D7 B4EB B7CE D320 C1A6 B0F8 B5CB B4CF"            /* ±◊¥Î∑Œ” ¡¶∞¯µÀ¥œ */
	$"B4D9 2E20 B9FD B7FC BFA1 BCAD 20C7 E3BF"            /* ¥Ÿ. π˝∑¸ø°º≠ «„ø */
	$"EBC7 CFB4 C220 B9FC C0A7 20B3 BBBF A1BC"            /* Î«œ¥¬ π¸¿ß ≥ªø°º */
	$"AD2C 204D 4F5A 494C 4C41 2C20 4D4F 5A49"            /* ≠, MOZILLA, MOZI */
	$"4C4C 41C0 C720 C0AF C5EB BEF7 C3BC B5E9"            /* LLA¿« ¿Ø≈Îæ˜√ºµÈ */
	$"20B9 D720 B6F3 C0CC BCBE BDBA 20C7 E3BF"            /*  π◊ ∂Û¿ÃºæΩ∫ «„ø */
	$"A9C0 DAB5 E9C0 BA20 C1A6 C7B0 C0CC 20C7"            /* ©¿⁄µÈ¿∫ ¡¶«∞¿Ã « */
	$"CFC0 DAB0 A120 BEF8 B4D9 B0C5 B3AA 2C20"            /* œ¿⁄∞° æ¯¥Ÿ∞≈≥™,  */
	$"BBF3 BEF7 BCBA C0CC 20C0 D6B4 D9B0 C5B3"            /* ªÛæ˜º∫¿Ã ¿÷¥Ÿ∞≈≥ */
	$"AA2C 20C6 AFC1 A420 B8F1 C0FB BFA1 20C0"            /* ™, ∆Ø¡§ ∏Ò¿˚ø° ¿ */
	$"FBC7 D5C7 CFB0 ED20 C4A7 C7D8 B8A6 20BE"            /* ˚«’«œ∞Ì ƒß«ÿ∏¶ æ */
	$"DFB1 E2BD C3C5 B0C1 F620 BECA B4C2 B4D9"            /* ﬂ±‚Ω√≈∞¡ˆ æ ¥¬¥Ÿ */
	$"B4C2 20C3 EBC1 F6C0 C720 BAB8 C1F5 C0BB"            /* ¥¬ √Î¡ˆ¿« ∫∏¡ı¿ª */
	$"20C6 F7C7 D4C7 CFBF A92C 20B8 EDBD C3C0"            /*  ∆˜«‘«œø©, ∏ÌΩ√¿ */
	$"FB20 B6C7 B4C2 20BE CFBD C3C0 FBC0 CE20"            /* ˚ ∂«¥¬ æœΩ√¿˚¿Œ  */
	$"B8F0 B5E7 20BA B8C1 F5C0 BB20 BACE C0CE"            /* ∏µÁ ∫∏¡ı¿ª ∫Œ¿Œ */
	$"C7D5 B4CF B4D9 2E20 B1CD C7CF C0C7 20B8"            /* «’¥œ¥Ÿ. ±Õ«œ¿« ∏ */
	$"F1C0 FB20 B4DE BCBA C0BB 20C0 A7C7 D120"            /* Ò¿˚ ¥ﬁº∫¿ª ¿ß«—  */
	$"C1A6 C7B0 C0C7 20BC B1C5 C32C 20B1 D7B8"            /* ¡¶«∞¿« º±≈√, ±◊∏ */
	$"AEB0 ED20 C1A6 C7B0 C0C7 20C7 B0C1 FA20"            /* Æ∞Ì ¡¶«∞¿« «∞¡˙  */
	$"B9D7 20BC BAB4 C9BF A120 B4EB C7D8 BCAD"            /* π◊ º∫¥…ø° ¥Î«ÿº≠ */
	$"B4C2 20B1 CDC7 CFB0 A120 C0FC C0FB C0B8"            /* ¥¬ ±Õ«œ∞° ¿¸¿˚¿∏ */
	$"B7CE 20C0 A7C7 E8C0 BB20 B0A8 BCF6 C7D5"            /* ∑Œ ¿ß«Ë¿ª ∞®ºˆ«’ */
	$"B4CF B4D9 2E20 C0CC B7AF C7D1 20C1 A6C7"            /* ¥œ¥Ÿ. ¿Ã∑Ø«— ¡¶« */
	$"D1BB E7C7 D7C0 BA20 B1B8 C1A6 C3A5 C0C7"            /* —ªÁ«◊¿∫ ±∏¡¶√•¿« */
	$"20BA BBC1 FAC0 FBC0 CE20 B8F1 C0FB C0BB"            /*  ∫ª¡˙¿˚¿Œ ∏Ò¿˚¿ª */
	$"20B4 DEBC BAC7 CFC1 F620 B8F8 C7D1 B4D9"            /*  ¥ﬁº∫«œ¡ˆ ∏¯«—¥Ÿ */
	$"20C7 CFB4 F5B6 F3B5 B520 C0FB BFEB B5CB"            /*  «œ¥ı∂Ûµµ ¿˚øÎµÀ */
	$"B4CF B4D9 2E20 C0CF BACE 20B0 FCC7 D2B1"            /* ¥œ¥Ÿ. ¿œ∫Œ ∞¸«“± */
	$"C7BF A1BC ADB4 C220 BECF BDC3 C0FB 20BA"            /* «ø°º≠¥¬ æœΩ√¿˚ ∫ */
	$"B8C1 F5C0 C720 B9E8 C1A6 20B6 C7B4 C220"            /* ∏¡ı¿« πË¡¶ ∂«¥¬  */
	$"C1A6 C7D1 C0BB 20C7 E3BF EBC7 CFC1 F620"            /* ¡¶«—¿ª «„øÎ«œ¡ˆ  */
	$"BECA C0B8 B9C7 B7CE 2C20 C0CC B7AF C7D1"            /* æ ¿∏π«∑Œ, ¿Ã∑Ø«— */
	$"20BA CEC0 CEC0 BA20 B1CD C7CF BFA1 B0D4"            /*  ∫Œ¿Œ¿∫ ±Õ«œø°∞‘ */
	$"20C0 FBBF EBB5 C7C1 F620 BECA C0BB 20BC"            /*  ¿˚øÎµ«¡ˆ æ ¿ª º */
	$"F6B5 B520 C0D6 BDC0 B4CF B4D9 2E0D 0D35"            /* ˆµµ ¿÷Ω¿¥œ¥Ÿ...5 */
	$"2E20 C3A5 C0D3 C0C7 20C1 A6C7 D12E 20B9"            /* . √•¿”¿« ¡¶«—. π */
	$"FDB7 FCBF A1BC AD20 B1D4 C1A4 C7CF B4C2"            /* ˝∑¸ø°º≠ ±‘¡§«œ¥¬ */
	$"20B0 E6BF ECB8 A620 C1A6 BFDC C7CF B0ED"            /*  ∞ÊøÏ∏¶ ¡¶ø‹«œ∞Ì */
	$"2C20 4D4F 5A49 4C4C 412C 204D 4F5A 494C"            /* , MOZILLA, MOZIL */
	$"4C41 C0C7 20C0 AFC5 EBBE F7C3 BCB5 E92C"            /* LA¿« ¿Ø≈Îæ˜√ºµÈ, */
	$"20C0 CCBB E7B5 E92C 20B6 F3C0 CCBC BEBD"            /*  ¿ÃªÁµÈ, ∂Û¿ÃºæΩ */
	$"BA20 C7E3 BFA9 C0DA B5E9 2C20 B1E2 BACE"            /* ∫ «„ø©¿⁄µÈ, ±‚∫Œ */
	$"C0DA B5E9 20B9 D720 B4EB B8AE C0CE B5E9"            /* ¿⁄µÈ π◊ ¥Î∏Æ¿ŒµÈ */
	$"28C3 D1C4 AAC7 CFBF A920 224D 4F5A 494C"            /* (√—ƒ™«œø© "MOZIL */
	$"4C41 2047 524F 5550 2229 C0BA 20C0 CC20"            /* LA GROUP")¿∫ ¿Ã  */
	$"B0E8 BEE0 2C20 C1A6 C7B0 C0C7 20BB E7BF"            /* ∞Ëæ‡, ¡¶«∞¿« ªÁø */
	$"EB20 B6C7 B4C2 20C1 A6C7 B020 BBE7 BFEB"            /* Î ∂«¥¬ ¡¶«∞ ªÁøÎ */
	$"20BA D2B0 A1B4 C9C0 B8B7 CE20 C0CE C7CF"            /*  ∫“∞°¥…¿∏∑Œ ¿Œ«œ */
	$"BFA9 20B9 DFBB FDC7 CFB0 C5B3 AA2C 20B5"            /* ø© πﬂª˝«œ∞≈≥™, µ */
	$"BF20 BBE7 C7D7 B5E9 B0FA 20BE EEB6 B0C7"            /* ø ªÁ«◊µÈ∞˙ æÓ∂∞« */
	$"D120 B9E6 BDC4 C0B8 B7CE B5E7 C1F6 20B0"            /* — πÊΩƒ¿∏∑ŒµÁ¡ˆ ∞ */
	$"FCB7 C3C7 CFBF A920 B9DF BBFD C7CF B4C2"            /* ¸∑√«œø© πﬂª˝«œ¥¬ */
	$"20B8 F0B5 E720 B0A3 C1A2 2C20 C6AF BAB0"            /*  ∏µÁ ∞£¡¢, ∆Ø∫∞ */
	$"2C20 BACE BCF6 C0FB 20B6 C7B4 C220 C0FC"            /* , ∫Œºˆ¿˚ ∂«¥¬ ¿¸ */
	$"C7FC C0FB 20BC D5C7 D828 BFB5 BEF7 B1C7"            /* «¸¿˚ º’«ÿ(øµæ˜±« */
	$"20BC D5BD C72C 20C0 DBBE F720 C1DF B4DC"            /*  º’Ω«, ¿€æ˜ ¡ﬂ¥‹ */
	$"2C20 C0CF BDC7 20BC F6C0 CD2C 20B5 A5C0"            /* , ¿œΩ« ºˆ¿Õ, µ•¿ */
	$"CCC5 CD20 BCD5 BDC7 2C20 B9D7 20C4 C4C7"            /* Ã≈Õ º’Ω«, π◊ ƒƒ« */
	$"BBC5 CD20 B0ED C0E5 20B6 C7B4 C220 BFC0"            /* ª≈Õ ∞Ì¿Â ∂«¥¬ ø¿ */
	$"B5BF C0DB C0B8 B7CE 20C0 CEC7 D120 BCD5"            /* µø¿€¿∏∑Œ ¿Œ«— º’ */
	$"C7D8 20C6 F7C7 D429 BFA1 20B4 EBC7 D820"            /* «ÿ ∆˜«‘)ø° ¥Î«ÿ  */
	$"B9DF BBFD 20B0 A1B4 C9BC BAC0 BB20 BBE7"            /* πﬂª˝ ∞°¥…º∫¿ª ªÁ */
	$"C0FC BFA1 20C5 EBC1 F620 B9DE BED2 B4D9"            /* ¿¸ø° ≈Î¡ˆ πﬁæ“¥Ÿ */
	$"20C7 CFB4 F5B6 F3B5 B520 C3A5 C0D3 C1F6"            /*  «œ¥ı∂Ûµµ √•¿”¡ˆ */
	$"C1F6 20BE CAC0 B8B8 E72C 20BC D5C7 D8B9"            /* ¡ˆ æ ¿∏∏Á, º’«ÿπ */
	$"E8BB F3C0 C720 C3BB B1B8 20B1 D9B0 C5B0"            /* ËªÛ¿« √ª±∏ ±Ÿ∞≈∞ */
	$"A120 BEEE B6B0 C7D1 20B0 CD28 B0E8 BEE0"            /* ° æÓ∂∞«— ∞Õ(∞Ëæ‡ */
	$"BBF3 2C20 BAD2 B9FD C7E0 C0A7 20B5 EEC0"            /* ªÛ, ∫“π˝«‡¿ß µÓ¿ */
	$"C720 B9DF BBFD 29C0 CCB5 E7C1 F6B4 C220"            /* « πﬂª˝)¿ÃµÁ¡ˆ¥¬  */
	$"B0FC B0E8 20BE F8BD C0B4 CFB4 D92E 20C0"            /* ∞¸∞Ë æ¯Ω¿¥œ¥Ÿ. ¿ */
	$"CC20 B0E8 BEE0 BFA1 20B5 FBB6 F320 4D4F"            /* Ã ∞Ëæ‡ø° µ˚∂Û MO */
	$"5A49 4C4C 4120 4752 4F55 50C0 CC20 BACE"            /* ZILLA GROUP¿Ã ∫Œ */
	$"B4E3 C7D8 BEDF 20C7 CFB4 C220 C3D1 20C3"            /* ¥„«ÿæﬂ «œ¥¬ √— √ */
	$"A4B9 ABB4 C220 B9CC C8AD 2035 3030 20B4"            /* §π´¥¬ πÃ»≠ 500 ¥ */
	$"DEB7 AF20 B9D7 20B1 CDC7 CFB0 A120 C0CC"            /* ﬁ∑Ø π◊ ±Õ«œ∞° ¿Ã */
	$"20B6 F3C0 CCBC BEBD BABF A120 B5FB B6F3"            /*  ∂Û¿ÃºæΩ∫ø° µ˚∂Û */
	$"20C1 F6B1 DEC7 D120 BCF6 BCF6 B7E1 20C1"            /*  ¡ˆ±ﬁ«— ºˆºˆ∑· ¡ */
	$"DF20 B4F5 20B3 F4C0 BA20 B1DD BED7 C0BB"            /* ﬂ ¥ı ≥Ù¿∫ ±›æ◊¿ª */
	$"20BB F3C8 B8C7 CFC1 F620 BECA BDC0 B4CF"            /*  ªÛ»∏«œ¡ˆ æ Ω¿¥œ */
	$"B4D9 2E20 C0CF BACE 20B0 FCC7 D2B1 C7BF"            /* ¥Ÿ. ¿œ∫Œ ∞¸«“±«ø */
	$"A1BC ADB4 C220 B0A3 C1A2 C0FB 2C20 BACE"            /* °º≠¥¬ ∞£¡¢¿˚, ∫Œ */
	$"BCF6 C0FB 20B6 C7B4 C220 C6AF BAB0 20BC"            /* ºˆ¿˚ ∂«¥¬ ∆Ø∫∞ º */
	$"D5C7 D8C0 C720 B9E8 C1A6 20B6 C7B4 C220"            /* ’«ÿ¿« πË¡¶ ∂«¥¬  */
	$"C1A6 C7D1 C0BB 20C7 E3BF EBC7 CFC1 F620"            /* ¡¶«—¿ª «„øÎ«œ¡ˆ  */
	$"BECA C0B8 B9C7 B7CE 2C20 C0CC B7AF C7D1"            /* æ ¿∏π«∑Œ, ¿Ã∑Ø«— */
	$"20B9 E8C1 A620 B9D7 20C1 A6C7 D1C0 BA20"            /*  πË¡¶ π◊ ¡¶«—¿∫  */
	$"B1CD C7CF BFA1 B0D4 20C0 FBBF EBB5 C7C1"            /* ±Õ«œø°∞‘ ¿˚øÎµ«¡ */
	$"F620 BECA C0BB 20BC F6B5 B520 C0D6 BDC0"            /* ˆ æ ¿ª ºˆµµ ¿÷Ω¿ */
	$"B4CF B4D9 2E0D 0D36 2E20 BCF6 C3E2 20B1"            /* ¥œ¥Ÿ...6. ºˆ√‚ ± */
	$"D4C1 A62E 20C0 CC20 B6F3 C0CC BCBE BDBA"            /* ‘¡¶. ¿Ã ∂Û¿ÃºæΩ∫ */
	$"B4C2 20C7 D8B4 E7B5 C7B4 C220 B8F0 B5E7"            /* ¥¬ «ÿ¥Áµ«¥¬ ∏µÁ */
	$"20BC F6C3 E220 C1A6 C7D1 C0C7 20C0 FBBF"            /*  ºˆ√‚ ¡¶«—¿« ¿˚ø */
	$"EBC0 BB20 B9DE BDC0 B4CF B4D9 2E20 B1CD"            /* Î¿ª πﬁΩ¿¥œ¥Ÿ. ±Õ */
	$"C7CF B4C2 20C1 A6C7 B020 B9D7 20C1 A6C7"            /* «œ¥¬ ¡¶«∞ π◊ ¡¶« */
	$"B0C0 C720 BBE7 BFEB B0FA 20B0 FCB7 C3C7"            /* ∞¿« ªÁøÎ∞˙ ∞¸∑√« */
	$"CFBF A920 B9CC C7D5 C1DF B1B9 2C20 C7D8"            /* œø© πÃ«’¡ﬂ±π, «ÿ */
	$"BFDC 20B4 E7B1 B9C0 C720 B8F0 B5E7 20BC"            /* ø‹ ¥Á±π¿« ∏µÁ º */
	$"F6C3 E2C0 D420 B9FD B7FC 2C20 C1A6 C7D1"            /* ˆ√‚¿‘ π˝∑¸, ¡¶«— */
	$"20B9 D720 B1D4 C1A4 C0BB 20C1 D8BC F6C7"            /*  π◊ ±‘¡§¿ª ¡ÿºˆ« */
	$"D8BE DF20 C7D5 B4CF B4D9 2E0D 0D37 2E20"            /* ÿæﬂ «’¥œ¥Ÿ...7.  */
	$"B9CC C7D5 C1DF B1B9 20C1 A4BA CE20 C3D6"            /* πÃ«’¡ﬂ±π ¡§∫Œ √÷ */
	$"C1BE BBE7 BFEB C0DA B5E9 2E20 C1A6 C7B0"            /* ¡æªÁøÎ¿⁄µÈ. ¡¶«∞ */
	$"C0BA 2034 3820 432E 462E 522E 2032 2E31"            /* ¿∫ 48 C.F.R. 2.1 */
	$"3031 BFA1 20C1 A4C0 C7B5 C820 B9D9 BFCD"            /* 01ø° ¡§¿«µ» πŸøÕ */
	$"20B0 B0C0 CC20 D2BB F3BE F7C0 FB20 C7D7"            /*  ∞∞¿Ã “ªÛæ˜¿˚ «◊ */
	$"B8F1 D3C0 CCB0 ED2C 2034 3820 432E 462E"            /* ∏Ò”¿Ã∞Ì, 48 C.F. */
	$"522E 2031 322E 3231 3228 3139 3935 B3E2"            /* R. 12.212(1995≥‚ */
	$"2039 BFF9 2920 B9D7 2034 3820 432E 462E"            /*  9ø˘) π◊ 48 C.F. */
	$"522E 2032 3237 2E37 3230 3228 3139 3935"            /* R. 227.7202(1995 */
	$"B3E2 2036 BFF9 29BF A120 BBE7 BFEB B5C8"            /* ≥‚ 6ø˘)ø° ªÁøÎµ» */
	$"20BF EBBE EEB5 E9C0 CE20 22BB F3BE F7C0"            /*  øÎæÓµÈ¿Œ "ªÛæ˜¿ */
	$"FB20 C4C4 C7BB C5CD 20BC D2C7 C1C6 AEBF"            /* ˚ ƒƒ«ª≈Õ º“«¡∆Æø */
	$"FEBE EED3 20B9 D720 22BB F3BE F7C0 FB20"            /* ˛æÓ” π◊ "ªÛæ˜¿˚  */
	$"C4C4 C7BB C5CD 20BC D2C7 C1C6 AEBF FEBE"            /* ƒƒ«ª≈Õ º“«¡∆Æø˛æ */
	$"EE20 B9AE BCAD D3B7 CE20 B1B8 BCBA B5C7"            /* Ó πÆº≠”∑Œ ±∏º∫µ« */
	$"BEEE 20C0 D6BD C0B4 CFB4 D92E 2034 3820"            /* æÓ ¿÷Ω¿¥œ¥Ÿ. 48  */
	$"432E 462E 522E 2031 322E 3231 322C 2034"            /* C.F.R. 12.212, 4 */
	$"3820 432E 462E 522E 2032 372E 3430 3528"            /* 8 C.F.R. 27.405( */
	$"6229 2832 2928 3139 3938 B3E2 2036 BFF9"            /* b)(2)(1998≥‚ 6ø˘ */
	$"2920 B9D7 2034 3820 432E 462E 522E 2032"            /* ) π◊ 48 C.F.R. 2 */
	$"3237 2E37 3230 32BF A120 B5FB B6F3 2C20"            /* 27.7202ø° µ˚∂Û,  */
	$"B8F0 B5E7 20B9 CCC7 D5C1 DFB1 B920 C1A4"            /* ∏µÁ πÃ«’¡ﬂ±π ¡§ */
	$"BACE 20C3 D6C1 BEBB E7BF EBC0 DAB5 E9C0"            /* ∫Œ √÷¡æªÁøÎ¿⁄µÈ¿ */
	$"BA20 C0CC 20B0 E8BE E0BF A120 B8ED BDC3"            /* ∫ ¿Ã ∞Ëæ‡ø° ∏ÌΩ√ */
	$"B5C8 20B1 C7B8 AEB5 E9B0 FA20 C7D4 B2B2"            /* µ» ±«∏ÆµÈ∞˙ «‘≤≤ */
	$"20C1 A6C7 B0C0 BB20 C8B9 B5E6 C7D5 B4CF"            /*  ¡¶«∞¿ª »πµÊ«’¥œ */
	$"B4D9 2E0D 0D38 2E20 C0CF B9DD C1B6 C7D7"            /* ¥Ÿ...8. ¿œπ›¡∂«◊ */
	$"2E20 2861 2920 C0CC 20B0 E8BE E0C0 BA20"            /* . (a) ¿Ã ∞Ëæ‡¿∫  */
	$"C0CC 20B0 E8BE E0C0 C720 C1D6 C1A6 BFCD"            /* ¿Ã ∞Ëæ‡¿« ¡÷¡¶øÕ */
	$"20B0 FCB7 C3C7 CFBF A920 4D6F 7A69 6C6C"            /*  ∞¸∑√«œø© Mozill */
	$"6120 B9D7 20B1 CDC7 CF20 BBE7 C0CC BFA1"            /* a π◊ ±Õ«œ ªÁ¿Ãø° */
	$"20C3 BCB0 E1B5 C820 BFCF C0FC C7D1 20C7"            /*  √º∞·µ» øœ¿¸«— « */
	$"D5C0 C7B7 CE20 B1B8 BCBA B5C7 BEEE 20C0"            /* ’¿«∑Œ ±∏º∫µ«æÓ ¿ */
	$"D6C0 B8B8 E72C 204D 6F7A 696C 6C61 C0C7"            /* ÷¿∏∏Á, Mozilla¿« */
	$"20BC F6B1 C720 B0A3 BACE B0A1 20BC ADB8"            /*  ºˆ±« ∞£∫Œ∞° º≠∏ */
	$"EDC7 D120 BCAD B8E9 20BA AFB0 E6BA BBBF"            /* Ì«— º≠∏È ∫Ø∞Ê∫ªø */
	$"A120 C0C7 C7D8 BCAD B8B8 20BA AFB0 E6B5"            /* ° ¿««ÿº≠∏∏ ∫Ø∞Êµ */
	$"C920 BCF6 20C0 D6BD C0B4 CFB4 D92E 2028"            /* … ºˆ ¿÷Ω¿¥œ¥Ÿ. ( */
	$"6229 20C1 D8B0 C5B9 FDBF A1BC AD20 B4DE"            /* b) ¡ÿ∞≈π˝ø°º≠ ¥ﬁ */
	$"B8AE 20B1 D4C1 A4C7 CFB4 C220 B0E6 BFEC"            /* ∏Æ ±‘¡§«œ¥¬ ∞ÊøÏ */
	$"B8A6 20C1 A6BF DCC7 CFB0 ED2C 20C0 CC20"            /* ∏¶ ¡¶ø‹«œ∞Ì, ¿Ã  */
	$"B0E8 BEE0 C0BA 20BC B7BF DCBB E7B9 FDBF"            /* ∞Ëæ‡¿∫ º∑ø‹ªÁπ˝ø */
	$"A120 C0D6 BEEE BCAD C0C7 20B9 FDB8 AEBF"            /* ° ¿÷æÓº≠¿« π˝∏Æø */
	$"A120 B1B8 BED6 B9DE C1F6 20BE CAB0 ED20"            /* ° ±∏æ÷πﬁ¡ˆ æ ∞Ì  */
	$"B9CC C7D5 C1DF B1B9 20C4 B6B8 AEC6 F7B4"            /* πÃ«’¡ﬂ±π ƒ∂∏Æ∆˜¥ */
	$"CFBE C620 C1D6 C0C7 20B9 FDB7 FCBF A120"            /* œæ∆ ¡÷¿« π˝∑¸ø°  */
	$"C0C7 C7D8 20B1 D4C0 B2B5 CBB4 CFB4 D92E"            /* ¿««ÿ ±‘¿≤µÀ¥œ¥Ÿ. */
	$"2028 6329 20C0 CC20 B0E8 BEE0 C0BA 20B1"            /*  (c) ¿Ã ∞Ëæ‡¿∫ ± */
	$"B9C1 A6B9 B0C7 B0B8 C5B8 C5B0 E8BE E0BF"            /* π¡¶π∞«∞∏≈∏≈∞Ëæ‡ø */
	$"A120 B0FC C7D1 20B1 B9C1 A6BF ACC7 D5C7"            /* ° ∞¸«— ±π¡¶ø¨«’« */
	$"F9BE E0BF A120 C0C7 C7D8 20B1 D4C0 B2B5"            /* ˘æ‡ø° ¿««ÿ ±‘¿≤µ */
	$"C7C1 F620 BECA BDC0 B4CF B4D9 2E20 2864"            /* «¡ˆ æ Ω¿¥œ¥Ÿ. (d */
	$"2920 C0CC 20B0 E8BE E0C0 C720 C6AF C1A4"            /* ) ¿Ã ∞Ëæ‡¿« ∆Ø¡§ */
	$"20C0 CFBA CEB0 A120 B9AB C8BF 20B6 C7B4"            /*  ¿œ∫Œ∞° π´»ø ∂«¥ */
	$"C220 C1FD C7E0 20BA D2B0 A1C7 CFB4 D9B0"            /* ¬ ¡˝«‡ ∫“∞°«œ¥Ÿ∞ */
	$"ED20 C6C7 BDC3 B5C7 B4C2 20B0 E6BF EC2C"            /* Ì ∆«Ω√µ«¥¬ ∞ÊøÏ, */
	$"20C7 D8B4 E720 C0CF BACE B4C2 20B4 E7BB"            /*  «ÿ¥Á ¿œ∫Œ¥¬ ¥Áª */
	$"E7C0 DAB5 E9C0 C720 BFF8 B7A1 20C0 C7B5"            /* Á¿⁄µÈ¿« ø¯∑° ¿«µ */
	$"B5B8 A620 B9DD BFB5 C7D2 20BC F620 C0D6"            /* µ∏¶ π›øµ«“ ºˆ ¿÷ */
	$"B4C2 20B9 E6B9 FDC0 B8B7 CE20 C7D8 BCAE"            /* ¥¬ πÊπ˝¿∏∑Œ «ÿºÆ */
	$"B5C7 B8E7 2C20 B3AA B8D3 C1F6 20BA CEBA"            /* µ«∏Á, ≥™∏”¡ˆ ∫Œ∫ */
	$"D0B5 E9C0 BA20 BFCF C0FC C7D1 20C8 BFB7"            /* –µÈ¿∫ øœ¿¸«— »ø∑ */
	$"C2C0 BB20 C0AF C1F6 C7D5 B4CF B4D9 2E20"            /* ¬¿ª ¿Ø¡ˆ«’¥œ¥Ÿ.  */
	$"2865 2920 BEEE B4C0 20C0 CFB9 E620 B4E7"            /* (e) æÓ¥¿ ¿œπÊ ¥Á */
	$"BBE7 C0DA B0A1 2031 C8B8 20C0 CC20 B0E8"            /* ªÁ¿⁄∞° 1»∏ ¿Ã ∞Ë */
	$"BEE0 C0C7 20C6 AFC1 A420 C1B6 B0C7 C0BB"            /* æ‡¿« ∆Ø¡§ ¡∂∞«¿ª */
	$"20C6 F7B1 E2C7 CFB0 C5B3 AA2C 20B5 BF20"            /*  ∆˜±‚«œ∞≈≥™, µø  */
	$"C1B6 B0C7 C0C7 20C0 A7B9 DDBD C320 C1D6"            /* ¡∂∞«¿« ¿ßπ›Ω√ ¡÷ */
	$"C0E5 C7D2 20BC F620 C0D6 B4C2 20B1 C7B8"            /* ¿Â«“ ºˆ ¿÷¥¬ ±«∏ */
	$"AEB8 A620 C6F7 B1E2 C7CF B4C2 20B0 E6BF"            /* Æ∏¶ ∆˜±‚«œ¥¬ ∞Êø */
	$"EC2C 20C0 CCB4 C220 C7E2 C8C4 BFA1 B5B5"            /* Ï, ¿Ã¥¬ «‚»ƒø°µµ */
	$"20B5 BF20 C1B6 B0C7 C0BB 20C6 F7B1 E2C7"            /*  µø ¡∂∞«¿ª ∆˜±‚« */
	$"D1B4 D9B0 C5B3 AA2C 20B5 BF20 C1B6 B0C7"            /* —¥Ÿ∞≈≥™, µø ¡∂∞« */
	$"C0C7 20C0 A7B9 DD20 BDC3 20C1 D6C0 E5C7"            /* ¿« ¿ßπ› Ω√ ¡÷¿Â« */
	$"D220 BCF6 20C0 D6B4 C220 B1C7 B8AE B8A6"            /* “ ºˆ ¿÷¥¬ ±«∏Æ∏¶ */
	$"20C6 F7B1 E2C7 CFB4 C220 B0CD C0B8 B7CE"            /*  ∆˜±‚«œ¥¬ ∞Õ¿∏∑Œ */
	$"20C7 D8BC AEB5 C7C1 F620 BECA BDC0 B4CF"            /*  «ÿºÆµ«¡ˆ æ Ω¿¥œ */
	$"B4D9 2E20 2866 2920 B9FD B7FC BFA1 BCAD"            /* ¥Ÿ. (f) π˝∑¸ø°º≠ */
	$"20B1 D4C1 A4C7 CFB4 C220 B0E6 BFEC B8A6"            /*  ±‘¡§«œ¥¬ ∞ÊøÏ∏¶ */
	$"20C1 A6BF DCC7 CFB0 ED2C 20C0 CC20 B0E8"            /*  ¡¶ø‹«œ∞Ì, ¿Ã ∞Ë */
	$"BEE0 C0BA 20BF B5BE EEB7 CE20 C0DB BCBA"            /* æ‡¿∫ øµæÓ∑Œ ¿€º∫ */
	$"B5CB B4CF B4D9 2E20 2867 2920 B1CD C7CF"            /* µÀ¥œ¥Ÿ. (g) ±Õ«œ */
	$"B4C2 20C0 CC20 B0E8 BEE0 BFA1 20B5 FBB8"            /* ¥¬ ¿Ã ∞Ëæ‡ø° µ˚∏ */
	$"A520 B1CD C7CF C0C7 20B1 C7B8 AEB8 A620"            /* • ±Õ«œ¿« ±«∏Æ∏¶  */
	$"C0CC 20B0 E8BE E0C0 C720 C1B6 B0C7 BFA1"            /* ¿Ã ∞Ëæ‡¿« ¡∂∞«ø° */
	$"20B5 BFC0 C7C7 CFB0 ED20 B5BF 20C1 B6B0"            /*  µø¿««œ∞Ì µø ¡∂∞ */
	$"C7BF A120 C0C7 C7D8 20B1 B8BC D3B9 DEB1"            /* «ø° ¿««ÿ ±∏º”πﬁ± */
	$"E2B7 CE20 C7D5 C0C7 C7CF B4C2 20B8 F0B5"            /* ‚∑Œ «’¿««œ¥¬ ∏µ */
	$"E720 B4E7 BBE7 C0DA B0A1 BFA1 B0D4 20BE"            /* Á ¥ÁªÁ¿⁄∞°ø°∞‘ æ */
	$"E7B5 B5C7 D220 BCF6 20C0 D6BD C0B4 CFB4"            /* Áµµ«“ ºˆ ¿÷Ω¿¥œ¥ */
	$"D92E 204D 6F7A 696C 6C61 2046 6F75 6E64"            /* Ÿ. Mozilla Found */
	$"6174 696F 6EC0 BA20 C0CC 20B0 E8BE E0BF"            /* ation¿∫ ¿Ã ∞Ëæ‡ø */
	$"A120 B5FB B8A5 20C0 DABD C5C0 C720 B1C7"            /* ° µ˚∏• ¿⁄Ω≈¿« ±« */
	$"B8AE B8A6 20B9 ABC1 B6B0 C720 BEE7 B5B5"            /* ∏Æ∏¶ π´¡∂∞« æÁµµ */
	$"C7D2 20BC F620 C0D6 BDC0 B4CF B4D9 2E20"            /* «“ ºˆ ¿÷Ω¿¥œ¥Ÿ.  */
	$"2868 2920 C0CC 20B0 E8BE E0C0 BA20 B4E7"            /* (h) ¿Ã ∞Ëæ‡¿∫ ¥Á */
	$"BBE7 C0DA B5E9 2C20 C0CC B5E9 C0C7 20BD"            /* ªÁ¿⁄µÈ, ¿ÃµÈ¿« Ω */
	$"C2B0 E8C0 CE20 B9D7 20C7 E3BF EBB5 C820"            /* ¬∞Ë¿Œ π◊ «„øÎµ»  */
	$"BEE7 BCF6 C0CE B5E9 BFA1 20B4 EBC7 D120"            /* æÁºˆ¿ŒµÈø° ¥Î«—  */
	$"B1B8 BCD3 B7C2 C0CC 20C0 D6C0 B8B8 E72C"            /* ±∏º”∑¬¿Ã ¿÷¿∏∏Á, */
	$"20B5 BFC0 CEB5 E9C0 C720 C0CC C0CD C0BB"            /*  µø¿ŒµÈ¿« ¿Ã¿Õ¿ª */
	$"20C0 A7C7 D820 C0FB BFEB B5CB B4CF B4D9"            /*  ¿ß«ÿ ¿˚øÎµÀ¥œ¥Ÿ */
	$"2E"                                                 /* . */
};

data 'styl' (5006, "Korean SLA") {
	$"0613 0000 0000 000E 000A 4402 0090 000C"            /* .........¬D..ê.. */
	$"0000 0000 0000 0000 0002 000F 000C 0400"            /* ................ */
	$"0090 000C 0000 0000 0000 0000 0003 000E"            /* .ê.............. */
	$"000A 4402 0090 000C 0000 0000 0000 0000"            /* .¬D..ê.......... */
	$"0009 000F 000C 0400 0090 000C 0000 0000"            /* .∆.......ê...... */
	$"0000 0000 0011 000E 000A 4402 0090 000C"            /* .........¬D..ê.. */
	$"0000 0000 0000 0000 0029 000F 000C 0400"            /* .........)...... */
	$"0090 000C 0000 0000 0000 0000 002A 000E"            /* .ê...........*.. */
	$"000A 4402 0090 000C 0000 0000 0000 0000"            /* .¬D..ê.......... */
	$"0030 000F 000C 0400 0090 000C 0000 0000"            /* .0.......ê...... */
	$"0000 0000 0031 000E 000A 4402 0090 000C"            /* .....1...¬D..ê.. */
	$"0000 0000 0000 0000 0037 000F 000C 0400"            /* .........7...... */
	$"0090 000C 0000 0000 0000 0000 0038 000E"            /* .ê...........8.. */
	$"000A 4402 0090 000C 0000 0000 0000 0000"            /* .¬D..ê.......... */
	$"003E 000F 000C 0400 0090 000C 0000 0000"            /* .>.......ê...... */
	$"0000 0000 003F 000E 000A 4402 0090 000C"            /* .....?...¬D..ê.. */
	$"0000 0000 0000 0000 0045 000F 000C 0400"            /* .........E...... */
	$"0090 000C 0000 0000 0000 0000 0046 000E"            /* .ê...........F.. */
	$"000A 4402 0090 000C 0000 0000 0000 0000"            /* .¬D..ê.......... */
	$"0052 000F 000C 0400 0090 000C 0000 0000"            /* .R.......ê...... */
	$"0000 0000 0054 000E 000A 4402 0090 000C"            /* .....T...¬D..ê.. */
	$"0000 0000 0000 0000 0056 000F 000C 0400"            /* .........V...... */
	$"0090 000C 0000 0000 0000 0000 0057 000E"            /* .ê...........W.. */
	$"000A 4402 0090 000C 0000 0000 0000 0000"            /* .¬D..ê.......... */
	$"0061 000F 000C 0400 0090 000C 0000 0000"            /* .a.......ê...... */
	$"0000 0000 0062 000E 000A 4402 0090 000C"            /* .....b...¬D..ê.. */
	$"0000 0000 0000 0000 0064 000F 000C 0400"            /* .........d...... */
	$"0090 000C 0000 0000 0000 0000 006C 000E"            /* .ê...........l.. */
	$"000A 4402 0090 000C 0000 0000 0000 0000"            /* .¬D..ê.......... */
	$"0072 000F 000C 0400 0090 000C 0000 0000"            /* .r.......ê...... */
	$"0000 0000 0073 000E 000A 4402 0090 000C"            /* .....s...¬D..ê.. */
	$"0000 0000 0000 0000 0077 000F 000C 0400"            /* .........w...... */
	$"0090 000C 0000 0000 0000 0000 0078 000E"            /* .ê...........x.. */
	$"000A 4402 0090 000C 0000 0000 0000 0000"            /* .¬D..ê.......... */
	$"0080 000F 000C 0400 0090 000C 0000 0000"            /* .Ä.......ê...... */
	$"0000 0000 0081 000E 000A 4402 0090 000C"            /* .....Å...¬D..ê.. */
	$"0000 0000 0000 0000 0087 000F 000C 0400"            /* .........á...... */
	$"0090 000C 0000 0000 0000 0000 0088 000E"            /* .ê...........à.. */
	$"000A 4402 0090 000C 0000 0000 0000 0000"            /* .¬D..ê.......... */
	$"008C 000F 000C 0400 0090 000C 0000 0000"            /* .å.......ê...... */
	$"0000 0000 008D 000E 000A 4402 0090 000C"            /* .....ç...¬D..ê.. */
	$"0000 0000 0000 0000 0095 000F 000C 0400"            /* .........ï...... */
	$"0090 000C 0000 0000 0000 0000 0096 000E"            /* .ê...........ñ.. */
	$"000A 4402 0090 000C 0000 0000 0000 0000"            /* .¬D..ê.......... */
	$"009E 000F 000C 0400 0090 000C 0000 0000"            /* .û.......ê...... */
	$"0000 0000 009F 000E 000A 4402 0090 000C"            /* .....ü...¬D..ê.. */
	$"0000 0000 0000 0000 00A3 000F 000C 0400"            /* .........£...... */
	$"0090 000C 0000 0000 0000 0000 00A4 000E"            /* .ê...........§.. */
	$"000A 4402 0090 000C 0000 0000 0000 0000"            /* .¬D..ê.......... */
	$"00AA 000F 000C 0400 0090 000C 0000 0000"            /* .™.......ê...... */
	$"0000 0000 00AC 000E 000A 4402 0090 000C"            /* .....¨...¬D..ê.. */
	$"0000 0000 0000 0000 00B6 000F 000C 0400"            /* .........∂...... */
	$"0090 000C 0000 0000 0000 0000 00B7 000E"            /* .ê...........∑.. */
	$"000A 4402 0090 000C 0000 0000 0000 0000"            /* .¬D..ê.......... */
	$"00BF 000F 000C 0400 0090 000C 0000 0000"            /* .ø.......ê...... */
	$"0000 0000 00C0 000E 000A 4402 0090 000C"            /* .....¿...¬D..ê.. */
	$"0000 0000 0000 0000 00C6 000F 000C 0400"            /* .........∆...... */
	$"0090 000C 0000 0000 0000 0000 00C7 000E"            /* .ê...........«.. */
	$"000A 4402 0090 000C 0000 0000 0000 0000"            /* .¬D..ê.......... */
	$"00CB 000F 000C 0400 0090 000C 0000 0000"            /* .À.......ê...... */
	$"0000 0000 00CC 000E 000A 4402 0090 000C"            /* .....Ã...¬D..ê.. */
	$"0000 0000 0000 0000 00D0 000F 000C 0400"            /* .........–...... */
	$"0090 000C 0000 0000 0000 0000 00D1 000E"            /* .ê...........—.. */
	$"000A 4402 0090 000C 0000 0000 0000 0000"            /* .¬D..ê.......... */
	$"00D5 000F 000C 0400 0090 000C 0000 0000"            /* .’.......ê...... */
	$"0000 0000 00D6 000E 000A 4402 0090 000C"            /* .....÷...¬D..ê.. */
	$"0000 0000 0000 0000 00DC 000F 000C 0400"            /* .........‹...... */
	$"0090 000C 0000 0000 0000 0000 00DD 000E"            /* .ê...........›.. */
	$"000A 4402 0090 000C 0000 0000 0000 0000"            /* .¬D..ê.......... */
	$"00E5 000F 000C 0400 0090 000C 0000 0000"            /* .Â.......ê...... */
	$"0000 0000 00E6 000E 000A 4402 0090 000C"            /* .....Ê...¬D..ê.. */
	$"0000 0000 0000 0000 00EA 000F 000C 0400"            /* .........Í...... */
	$"0090 000C 0000 0000 0000 0000 00EB 000E"            /* .ê...........Î.. */
	$"000A 4402 0090 000C 0000 0000 0000 0000"            /* .¬D..ê.......... */
	$"00F1 000F 000C 0400 0090 000C 0000 0000"            /* .Ò.......ê...... */
	$"0000 0000 00F2 000E 000A 4402 0090 000C"            /* .....Ú...¬D..ê.. */
	$"0000 0000 0000 0000 00F6 000F 000C 0400"            /* .........ˆ...... */
	$"0090 000C 0000 0000 0000 0000 00F7 000E"            /* .ê...........˜.. */
	$"000A 4402 0090 000C 0000 0000 0000 0000"            /* .¬D..ê.......... */
	$"00FF 000F 000C 0400 0090 000C 0000 0000"            /* .ˇ.......ê...... */
	$"0000 0000 0100 000E 000A 4402 0090 000C"            /* .........¬D..ê.. */
	$"0000 0000 0000 0000 0106 000F 000C 0400"            /* ................ */
	$"0090 000C 0000 0000 0000 0000 0107 000E"            /* .ê.............. */
	$"000A 4402 0090 000C 0000 0000 0000 0000"            /* .¬D..ê.......... */
	$"010F 000F 000C 0400 0090 000C 0000 0000"            /* .........ê...... */
	$"0000 0000 0110 000E 000A 4402 0090 000C"            /* .........¬D..ê.. */
	$"0000 0000 0000 0000 0118 000F 000C 0400"            /* ................ */
	$"0090 000C 0000 0000 0000 0000 011A 000E"            /* .ê.............. */
	$"000A 4402 0090 000C 0000 0000 0000 0000"            /* .¬D..ê.......... */
	$"0120 000F 000C 0400 0090 000C 0000 0000"            /* . .......ê...... */
	$"0000 0000 0122 000E 000A 4402 0090 000C"            /* ....."...¬D..ê.. */
	$"0000 0000 0000 0000 0128 000F 000C 0400"            /* .........(...... */
	$"0090 000C 0000 0000 0000 0000 0129 000E"            /* .ê...........).. */
	$"000A 4402 0090 000C 0000 0000 0000 0000"            /* .¬D..ê.......... */
	$"012F 000F 000C 0400 0090 000C 0000 0000"            /* ./.......ê...... */
	$"0000 0000 0130 000E 000A 4402 0090 000C"            /* .....0...¬D..ê.. */
	$"0000 0000 0000 0000 0134 000F 000C 0400"            /* .........4...... */
	$"0090 000C 0000 0000 0000 0000 0135 000E"            /* .ê...........5.. */
	$"000A 4402 0090 000C 0000 0000 0000 0000"            /* .¬D..ê.......... */
	$"013F 000F 000C 0400 0090 000C 0000 0000"            /* .?.......ê...... */
	$"0000 0000 0140 000E 000A 4402 0090 000C"            /* .....@...¬D..ê.. */
	$"0000 0000 0000 0000 0142 000F 000C 0400"            /* .........B...... */
	$"0090 000C 0000 0000 0000 0000 0143 000E"            /* .ê...........C.. */
	$"000A 4402 0090 000C 0000 0000 0000 0000"            /* .¬D..ê.......... */
	$"014B 000F 000C 0400 0090 000C 0000 0000"            /* .K.......ê...... */
	$"0000 0000 014C 000E 000A 4402 0090 000C"            /* .....L...¬D..ê.. */
	$"0000 0000 0000 0000 0150 000F 000C 0400"            /* .........P...... */
	$"0090 000C 0000 0000 0000 0000 0158 000E"            /* .ê...........X.. */
	$"000A 4402 0090 000C 0000 0000 0000 0000"            /* .¬D..ê.......... */
	$"015C 000F 000C 0400 0090 000C 0000 0000"            /* .\.......ê...... */
	$"0000 0000 015D 000E 000A 4402 0090 000C"            /* .....]...¬D..ê.. */
	$"0000 0000 0000 0000 0163 000F 000C 0400"            /* .........c...... */
	$"0090 000C 0000 0000 0000 0000 0164 000E"            /* .ê...........d.. */
	$"000A 4402 0090 000C 0000 0000 0000 0000"            /* .¬D..ê.......... */
	$"016C 000F 000C 0400 0090 000C 0000 0000"            /* .l.......ê...... */
	$"0000 0000 016D 000E 000A 4402 0090 000C"            /* .....m...¬D..ê.. */
	$"0000 0000 0000 0000 0173 000F 000C 0400"            /* .........s...... */
	$"0090 000C 0000 0000 0000 0000 0174 000E"            /* .ê...........t.. */
	$"000A 4402 0090 000C 0000 0000 0000 0000"            /* .¬D..ê.......... */
	$"0178 000F 000C 0400 0090 000C 0000 0000"            /* .x.......ê...... */
	$"0000 0000 0179 000E 000A 4402 0090 000C"            /* .....y...¬D..ê.. */
	$"0000 0000 0000 0000 017B 000F 000C 0400"            /* .........{...... */
	$"0090 000C 0000 0000 0000 0000 017C 000E"            /* .ê...........|.. */
	$"000A 4402 0090 000C 0000 0000 0000 0000"            /* .¬D..ê.......... */
	$"017E 000F 000C 0400 0090 000C 0000 0000"            /* .~.......ê...... */
	$"0000 0000 017F 000E 000A 4402 0090 000C"            /* .........¬D..ê.. */
	$"0000 0000 0000 0000 0185 000F 000C 0400"            /* .........Ö...... */
	$"0090 000C 0000 0000 0000 0000 0186 000E"            /* .ê...........Ü.. */
	$"000A 4402 0090 000C 0000 0000 0000 0000"            /* .¬D..ê.......... */
	$"0188 000F 000C 0400 0090 000C 0000 0000"            /* .à.......ê...... */
	$"0000 0000 0189 000E 000A 4402 0090 000C"            /* .....â...¬D..ê.. */
	$"0000 0000 0000 0000 018F 000F 000C 0400"            /* .........è...... */
	$"0090 000C 0000 0000 0000 0000 0190 000E"            /* .ê...........ê.. */
	$"000A 4402 0090 000C 0000 0000 0000 0000"            /* .¬D..ê.......... */
	$"0198 000F 000C 0400 0090 000C 0000 0000"            /* .ò.......ê...... */
	$"0000 0000 019B 000F 000C 0400 0190 000C"            /* .....õ.......ê.. */
	$"0000 0000 0000 0000 01A2 000E 000A 4402"            /* .........¢...¬D. */
	$"0090 000C 0000 0000 0000 0000 01A6 000F"            /* .ê...........¶.. */
	$"000C 0400 0190 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"01A7 000E 000A 4402 0090 000C 0000 0000"            /* .ß...¬D..ê...... */
	$"0000 0000 01AD 000F 000C 0400 0190 000C"            /* .....≠.......ê.. */
	$"0000 0000 0000 0000 01AE 000E 000A 4402"            /* .........Æ...¬D. */
	$"0090 000C 0000 0000 0000 0000 01B8 000F"            /* .ê...........∏.. */
	$"000C 0400 0190 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"01B9 000E 000A 4402 0090 000C 0000 0000"            /* .π...¬D..ê...... */
	$"0000 0000 01C1 000F 000C 0400 0190 000C"            /* .....¡.......ê.. */
	$"0000 0000 0000 0000 01C2 000E 000A 4402"            /* .........¬...¬D. */
	$"0090 000C 0000 0000 0000 0000 01CB 000F"            /* .ê...........À.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"01D1 000E 000A 4402 0090 000C 0000 0000"            /* .—...¬D..ê...... */
	$"0000 0000 01D7 000F 000C 0400 0090 000C"            /* .....◊.......ê.. */
	$"0000 0000 0000 0000 01D8 000E 000A 4402"            /* .........ÿ...¬D. */
	$"0090 000C 0000 0000 0000 0000 01DC 000F"            /* .ê...........‹.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"01DE 000E 000A 4402 0090 000C 0000 0000"            /* .ﬁ...¬D..ê...... */
	$"0000 0000 01E2 000F 000C 0400 0090 000C"            /* .....‚.......ê.. */
	$"0000 0000 0000 0000 01E3 000E 000A 4402"            /* .........„...¬D. */
	$"0090 000C 0000 0000 0000 0000 01E5 000F"            /* .ê...........Â.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"01E6 000E 000A 4402 0090 000C 0000 0000"            /* .Ê...¬D..ê...... */
	$"0000 0000 01EC 000F 000C 0400 0090 000C"            /* .....Ï.......ê.. */
	$"0000 0000 0000 0000 01ED 000E 000A 4402"            /* .........Ì...¬D. */
	$"0090 000C 0000 0000 0000 0000 01EF 000F"            /* .ê...........Ô.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"01F0 000E 000A 4402 0090 000C 0000 0000"            /* ....¬D..ê...... */
	$"0000 0000 01F4 000F 000C 0400 0090 000C"            /* .....Ù.......ê.. */
	$"0000 0000 0000 0000 01F5 000E 000A 4402"            /* .........ı...¬D. */
	$"0090 000C 0000 0000 0000 0000 01F9 000F"            /* .ê...........˘.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0201 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 0209 000F 000C 0400 0090 000C"            /* .....∆.......ê.. */
	$"0000 0000 0000 0000 020A 000E 000A 4402"            /* .........¬...¬D. */
	$"0090 000C 0000 0000 0000 0000 0210 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0211 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 0215 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 0216 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 021A 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"021B 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 0221 000F 000C 0400 0090 000C"            /* .....!.......ê.. */
	$"0000 0000 0000 0000 022A 000E 000A 4402"            /* .........*...¬D. */
	$"0090 000C 0000 0000 0000 0000 022E 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"022F 000E 000A 4402 0090 000C 0000 0000"            /* ./...¬D..ê...... */
	$"0000 0000 0237 000F 000C 0400 0090 000C"            /* .....7.......ê.. */
	$"0000 0000 0000 0000 0238 000E 000A 4402"            /* .........8...¬D. */
	$"0090 000C 0000 0000 0000 0000 023A 000F"            /* .ê...........:.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"023B 000E 000A 4402 0090 000C 0000 0000"            /* .;...¬D..ê...... */
	$"0000 0000 023F 000F 000C 0400 0090 000C"            /* .....?.......ê.. */
	$"0000 0000 0000 0000 0240 000E 000A 4402"            /* .........@...¬D. */
	$"0090 000C 0000 0000 0000 0000 0244 000F"            /* .ê...........D.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0245 000E 000A 4402 0090 000C 0000 0000"            /* .E...¬D..ê...... */
	$"0000 0000 0249 000F 000C 0400 0090 000C"            /* .....I.......ê.. */
	$"0000 0000 0000 0000 024A 000E 000A 4402"            /* .........J...¬D. */
	$"0090 000C 0000 0000 0000 0000 0254 000F"            /* .ê...........T.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0255 000E 000A 4402 0090 000C 0000 0000"            /* .U...¬D..ê...... */
	$"0000 0000 025F 000F 000C 0400 0090 000C"            /* ....._.......ê.. */
	$"0000 0000 0000 0000 0260 000E 000A 4402"            /* .........`...¬D. */
	$"0090 000C 0000 0000 0000 0000 0264 000F"            /* .ê...........d.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0274 000E 000A 4402 0090 000C 0000 0000"            /* .t...¬D..ê...... */
	$"0000 0000 0278 000F 000C 0400 0090 000C"            /* .....x.......ê.. */
	$"0000 0000 0000 0000 0279 000E 000A 4402"            /* .........y...¬D. */
	$"0090 000C 0000 0000 0000 0000 027F 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0280 000E 000A 4402 0090 000C 0000 0000"            /* .Ä...¬D..ê...... */
	$"0000 0000 028A 000F 000C 0400 0090 000C"            /* .....ä.......ê.. */
	$"0000 0000 0000 0000 028D 000E 000A 4402"            /* .........ç...¬D. */
	$"0090 000C 0000 0000 0000 0000 0295 000F"            /* .ê...........ï.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"029D 000E 000A 4402 0090 000C 0000 0000"            /* .ù...¬D..ê...... */
	$"0000 0000 02A1 000F 000C 0400 0090 000C"            /* .....°.......ê.. */
	$"0000 0000 0000 0000 02A2 000E 000A 4402"            /* .........¢...¬D. */
	$"0090 000C 0000 0000 0000 0000 02A6 000F"            /* .ê...........¶.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"02A7 000E 000A 4402 0090 000C 0000 0000"            /* .ß...¬D..ê...... */
	$"0000 0000 02AB 000F 000C 0400 0090 000C"            /* .....´.......ê.. */
	$"0000 0000 0000 0000 02AC 000E 000A 4402"            /* .........¨...¬D. */
	$"0090 000C 0000 0000 0000 0000 02AE 000F"            /* .ê...........Æ.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"02AF 000E 000A 4402 0090 000C 0000 0000"            /* .Ø...¬D..ê...... */
	$"0000 0000 02B3 000F 000C 0400 0090 000C"            /* .....≥.......ê.. */
	$"0000 0000 0000 0000 02B4 000E 000A 4402"            /* .........¥...¬D. */
	$"0090 000C 0000 0000 0000 0000 02B8 000F"            /* .ê...........∏.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"02BA 000E 000A 4402 0090 000C 0000 0000"            /* .∫...¬D..ê...... */
	$"0000 0000 02BE 000F 000C 0400 0090 000C"            /* .....æ.......ê.. */
	$"0000 0000 0000 0000 02C0 000E 000A 4402"            /* .........¿...¬D. */
	$"0090 000C 0000 0000 0000 0000 02C2 000F"            /* .ê...........¬.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"02C3 000E 000A 4402 0090 000C 0000 0000"            /* .√...¬D..ê...... */
	$"0000 0000 02C5 000F 000C 0400 0090 000C"            /* .....≈.......ê.. */
	$"0000 0000 0000 0000 02CD 000E 000A 4402"            /* .........Õ...¬D. */
	$"0090 000C 0000 0000 0000 0000 02D1 000F"            /* .ê...........—.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"02D2 000E 000A 4402 0090 000C 0000 0000"            /* .“...¬D..ê...... */
	$"0000 0000 02D8 000F 000C 0400 0090 000C"            /* .....ÿ.......ê.. */
	$"0000 0000 0000 0000 02D9 000E 000A 4402"            /* .........Ÿ...¬D. */
	$"0090 000C 0000 0000 0000 0000 02E3 000F"            /* .ê...........„.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"02E4 000E 000A 4402 0090 000C 0000 0000"            /* .‰...¬D..ê...... */
	$"0000 0000 02EC 000F 000C 0400 0090 000C"            /* .....Ï.......ê.. */
	$"0000 0000 0000 0000 02ED 000E 000A 4402"            /* .........Ì...¬D. */
	$"0090 000C 0000 0000 0000 0000 02F1 000F"            /* .ê...........Ò.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"02F3 000E 000A 4402 0090 000C 0000 0000"            /* .Û...¬D..ê...... */
	$"0000 0000 02F5 000F 000C 0400 0090 000C"            /* .....ı.......ê.. */
	$"0000 0000 0000 0000 02F6 000E 000A 4402"            /* .........ˆ...¬D. */
	$"0090 000C 0000 0000 0000 0000 02FA 000F"            /* .ê...........˙.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"02FC 000E 000A 4402 0090 000C 0000 0000"            /* .¸...¬D..ê...... */
	$"0000 0000 02FE 000F 000C 0400 0090 000C"            /* .....˛.......ê.. */
	$"0000 0000 0000 0000 02FF 000E 000A 4402"            /* .........ˇ...¬D. */
	$"0090 000C 0000 0000 0000 0000 0305 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0306 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 030A 000F 000C 0400 0090 000C"            /* .....¬.......ê.. */
	$"0000 0000 0000 0000 030B 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 0313 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0314 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 031C 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 031D 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 0325 000F"            /* .ê...........%.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0328 000E 000A 4402 0090 000C 0000 0000"            /* .(...¬D..ê...... */
	$"0000 0000 032C 000F 000C 0400 0090 000C"            /* .....,.......ê.. */
	$"0000 0000 0000 0000 0336 000E 000A 4402"            /* .........6...¬D. */
	$"0090 000C 0000 0000 0000 0000 033C 000F"            /* .ê...........<.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"033D 000E 000A 4402 0090 000C 0000 0000"            /* .=...¬D..ê...... */
	$"0000 0000 0347 000F 000C 0400 0090 000C"            /* .....G.......ê.. */
	$"0000 0000 0000 0000 0350 000E 000A 4402"            /* .........P...¬D. */
	$"0090 000C 0000 0000 0000 0000 035A 000F"            /* .ê...........Z.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"035B 000E 000A 4402 0090 000C 0000 0000"            /* .[...¬D..ê...... */
	$"0000 0000 035F 000F 000C 0400 0090 000C"            /* ....._.......ê.. */
	$"0000 0000 0000 0000 0360 000E 000A 4402"            /* .........`...¬D. */
	$"0090 000C 0000 0000 0000 0000 0364 000F"            /* .ê...........d.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0365 000E 000A 4402 0090 000C 0000 0000"            /* .e...¬D..ê...... */
	$"0000 0000 0371 000F 000C 0400 0090 000C"            /* .....q.......ê.. */
	$"0000 0000 0000 0000 0373 000E 000A 4402"            /* .........s...¬D. */
	$"0090 000C 0000 0000 0000 0000 0379 000F"            /* .ê...........y.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"037A 000E 000A 4402 0090 000C 0000 0000"            /* .z...¬D..ê...... */
	$"0000 0000 037C 000F 000C 0400 0090 000C"            /* .....|.......ê.. */
	$"0000 0000 0000 0000 037D 000E 000A 4402"            /* .........}...¬D. */
	$"0090 000C 0000 0000 0000 0000 0383 000F"            /* .ê...........É.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0384 000E 000A 4402 0090 000C 0000 0000"            /* .Ñ...¬D..ê...... */
	$"0000 0000 038C 000F 000C 0400 0090 000C"            /* .....å.......ê.. */
	$"0000 0000 0000 0000 038D 000E 000A 4402"            /* .........ç...¬D. */
	$"0090 000C 0000 0000 0000 0000 0391 000F"            /* .ê...........ë.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0392 000E 000A 4402 0090 000C 0000 0000"            /* .í...¬D..ê...... */
	$"0000 0000 039A 000F 000C 0400 0090 000C"            /* .....ö.......ê.. */
	$"0000 0000 0000 0000 039B 000E 000A 4402"            /* .........õ...¬D. */
	$"0090 000C 0000 0000 0000 0000 03A3 000F"            /* .ê...........£.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"03A5 000E 000A 4402 0090 000C 0000 0000"            /* .•...¬D..ê...... */
	$"0000 0000 03AB 000F 000C 0400 0090 000C"            /* .....´.......ê.. */
	$"0000 0000 0000 0000 03AC 000E 000A 4402"            /* .........¨...¬D. */
	$"0090 000C 0000 0000 0000 0000 03AE 000F"            /* .ê...........Æ.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"03AF 000E 000A 4402 0090 000C 0000 0000"            /* .Ø...¬D..ê...... */
	$"0000 0000 03B5 000F 000C 0400 0090 000C"            /* .....µ.......ê.. */
	$"0000 0000 0000 0000 03B6 000E 000A 4402"            /* .........∂...¬D. */
	$"0090 000C 0000 0000 0000 0000 03BC 000F"            /* .ê...........º.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"03BD 000E 000A 4402 0090 000C 0000 0000"            /* .Ω...¬D..ê...... */
	$"0000 0000 03C5 000F 000C 0400 0090 000C"            /* .....≈.......ê.. */
	$"0000 0000 0000 0000 03C6 000E 000A 4402"            /* .........∆...¬D. */
	$"0090 000C 0000 0000 0000 0000 03CA 000F"            /* .ê........... .. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"03CB 000E 000A 4402 0090 000C 0000 0000"            /* .À...¬D..ê...... */
	$"0000 0000 03CF 000F 000C 0400 0090 000C"            /* .....œ.......ê.. */
	$"0000 0000 0000 0000 03D2 000E 000A 4402"            /* .........“...¬D. */
	$"0090 000C 0000 0000 0000 0000 03D6 000F"            /* .ê...........÷.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"03D8 000E 000A 4402 0090 000C 0000 0000"            /* .ÿ...¬D..ê...... */
	$"0000 0000 03DE 000F 000C 0400 0090 000C"            /* .....ﬁ.......ê.. */
	$"0000 0000 0000 0000 03DF 000E 000A 4402"            /* .........ﬂ...¬D. */
	$"0090 000C 0000 0000 0000 0000 03E7 000F"            /* .ê...........Á.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"03E8 000E 000A 4402 0090 000C 0000 0000"            /* .Ë...¬D..ê...... */
	$"0000 0000 03EE 000F 000C 0400 0090 000C"            /* .....Ó.......ê.. */
	$"0000 0000 0000 0000 03F7 000E 000A 4402"            /* .........˜...¬D. */
	$"0090 000C 0000 0000 0000 0000 0401 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0402 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 0408 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 0409 000E 000A 4402"            /* .........∆...¬D. */
	$"0090 000C 0000 0000 0000 0000 040D 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"040E 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 0412 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 0413 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 041B 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"041C 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 0424 000F 000C 0400 0090 000C"            /* .....$.......ê.. */
	$"0000 0000 0000 0000 042C 000E 000A 4402"            /* .........,...¬D. */
	$"0090 000C 0000 0000 0000 0000 042E 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"042F 000E 000A 4402 0090 000C 0000 0000"            /* ./...¬D..ê...... */
	$"0000 0000 0433 000F 000C 0400 0090 000C"            /* .....3.......ê.. */
	$"0000 0000 0000 0000 0434 000E 000A 4402"            /* .........4...¬D. */
	$"0090 000C 0000 0000 0000 0000 0436 000F"            /* .ê...........6.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0437 000E 000A 4402 0090 000C 0000 0000"            /* .7...¬D..ê...... */
	$"0000 0000 0439 000F 000C 0400 0090 000C"            /* .....9.......ê.. */
	$"0000 0000 0000 0000 043A 000E 000A 4402"            /* .........:...¬D. */
	$"0090 000C 0000 0000 0000 0000 043C 000F"            /* .ê...........<.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"043D 000E 000A 4402 0090 000C 0000 0000"            /* .=...¬D..ê...... */
	$"0000 0000 0445 000F 000C 0400 0090 000C"            /* .....E.......ê.. */
	$"0000 0000 0000 0000 0446 000E 000A 4402"            /* .........F...¬D. */
	$"0090 000C 0000 0000 0000 0000 044C 000F"            /* .ê...........L.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"044D 000E 000A 4402 0090 000C 0000 0000"            /* .M...¬D..ê...... */
	$"0000 0000 044F 000F 000C 0400 0090 000C"            /* .....O.......ê.. */
	$"0000 0000 0000 0000 0451 000E 000A 4402"            /* .........Q...¬D. */
	$"0090 000C 0000 0000 0000 0000 045B 000F"            /* .ê...........[.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"045C 000E 000A 4402 0090 000C 0000 0000"            /* .\...¬D..ê...... */
	$"0000 0000 0466 000F 000C 0400 0090 000C"            /* .....f.......ê.. */
	$"0000 0000 0000 0000 0467 000E 000A 4402"            /* .........g...¬D. */
	$"0090 000C 0000 0000 0000 0000 046B 000F"            /* .ê...........k.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"046C 000E 000A 4402 0090 000C 0000 0000"            /* .l...¬D..ê...... */
	$"0000 0000 0470 000F 000C 0400 0090 000C"            /* .....p.......ê.. */
	$"0000 0000 0000 0000 0471 000E 000A 4402"            /* .........q...¬D. */
	$"0090 000C 0000 0000 0000 0000 0477 000F"            /* .ê...........w.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0478 000E 000A 4402 0090 000C 0000 0000"            /* .x...¬D..ê...... */
	$"0000 0000 047E 000F 000C 0400 0090 000C"            /* .....~.......ê.. */
	$"0000 0000 0000 0000 047F 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 0481 000F"            /* .ê...........Å.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0482 000E 000A 4402 0090 000C 0000 0000"            /* .Ç...¬D..ê...... */
	$"0000 0000 048A 000F 000C 0400 0090 000C"            /* .....ä.......ê.. */
	$"0000 0000 0000 0000 048C 000E 000A 4402"            /* .........å...¬D. */
	$"0090 000C 0000 0000 0000 0000 0492 000F"            /* .ê...........í.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0493 000E 000A 4402 0090 000C 0000 0000"            /* .ì...¬D..ê...... */
	$"0000 0000 0497 000F 000C 0400 0090 000C"            /* .....ó.......ê.. */
	$"0000 0000 0000 0000 0498 000E 000A 4402"            /* .........ò...¬D. */
	$"0090 000C 0000 0000 0000 0000 049C 000F"            /* .ê...........ú.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"049D 000E 000A 4402 0090 000C 0000 0000"            /* .ù...¬D..ê...... */
	$"0000 0000 04A3 000F 000C 0400 0090 000C"            /* .....£.......ê.. */
	$"0000 0000 0000 0000 04A4 000E 000A 4402"            /* .........§...¬D. */
	$"0090 000C 0000 0000 0000 0000 04A8 000F"            /* .ê...........®.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"04A9 000E 000A 4402 0090 000C 0000 0000"            /* .©...¬D..ê...... */
	$"0000 0000 04AB 000F 000C 0400 0090 000C"            /* .....´.......ê.. */
	$"0000 0000 0000 0000 04AC 000E 000A 4402"            /* .........¨...¬D. */
	$"0090 000C 0000 0000 0000 0000 04B2 000F"            /* .ê...........≤.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"04B3 000E 000A 4402 0090 000C 0000 0000"            /* .≥...¬D..ê...... */
	$"0000 0000 04B7 000F 000C 0400 0090 000C"            /* .....∑.......ê.. */
	$"0000 0000 0000 0000 04B8 000E 000A 4402"            /* .........∏...¬D. */
	$"0090 000C 0000 0000 0000 0000 04C0 000F"            /* .ê...........¿.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"04C1 000E 000A 4402 0090 000C 0000 0000"            /* .¡...¬D..ê...... */
	$"0000 0000 04C7 000F 000C 0400 0090 000C"            /* .....«.......ê.. */
	$"0000 0000 0000 0000 04C8 000E 000A 4402"            /* .........»...¬D. */
	$"0090 000C 0000 0000 0000 0000 04CE 000F"            /* .ê...........Œ.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"04CF 000E 000A 4402 0090 000C 0000 0000"            /* .œ...¬D..ê...... */
	$"0000 0000 04D7 000F 000C 0400 0090 000C"            /* .....◊.......ê.. */
	$"0000 0000 0000 0000 04DD 000E 000A 4402"            /* .........›...¬D. */
	$"0090 000C 0000 0000 0000 0000 04E5 000F"            /* .ê...........Â.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"04E6 000E 000A 4402 0090 000C 0000 0000"            /* .Ê...¬D..ê...... */
	$"0000 0000 04EA 000F 000C 0400 0090 000C"            /* .....Í.......ê.. */
	$"0000 0000 0000 0000 04FE 000E 000A 4402"            /* .........˛...¬D. */
	$"0090 000C 0000 0000 0000 0000 0500 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0501 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 0507 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 0508 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 0510 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0511 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 0515 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 0516 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 051C 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"051D 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 0523 000F 000C 0400 0090 000C"            /* .....#.......ê.. */
	$"0000 0000 0000 0000 0524 000E 000A 4402"            /* .........$...¬D. */
	$"0090 000C 0000 0000 0000 0000 0526 000F"            /* .ê...........&.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0527 000E 000A 4402 0090 000C 0000 0000"            /* .'...¬D..ê...... */
	$"0000 0000 052B 000F 000C 0400 0090 000C"            /* .....+.......ê.. */
	$"0000 0000 0000 0000 052C 000E 000A 4402"            /* .........,...¬D. */
	$"0090 000C 0000 0000 0000 0000 0534 000F"            /* .ê...........4.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0535 000E 000A 4402 0090 000C 0000 0000"            /* .5...¬D..ê...... */
	$"0000 0000 053F 000F 000C 0400 0090 000C"            /* .....?.......ê.. */
	$"0000 0000 0000 0000 0540 000E 000A 4402"            /* .........@...¬D. */
	$"0090 000C 0000 0000 0000 0000 0548 000F"            /* .ê...........H.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0549 000E 000A 4402 0090 000C 0000 0000"            /* .I...¬D..ê...... */
	$"0000 0000 0553 000F 000C 0400 0090 000C"            /* .....S.......ê.. */
	$"0000 0000 0000 0000 0555 000E 000A 4402"            /* .........U...¬D. */
	$"0090 000C 0000 0000 0000 0000 0557 000F"            /* .ê...........W.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0558 000E 000A 4402 0090 000C 0000 0000"            /* .X...¬D..ê...... */
	$"0000 0000 055E 000F 000C 0400 0090 000C"            /* .....^.......ê.. */
	$"0000 0000 0000 0000 055F 000E 000A 4402"            /* ........._...¬D. */
	$"0090 000C 0000 0000 0000 0000 0563 000F"            /* .ê...........c.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0564 000E 000A 4402 0090 000C 0000 0000"            /* .d...¬D..ê...... */
	$"0000 0000 056A 000F 000C 0400 0090 000C"            /* .....j.......ê.. */
	$"0000 0000 0000 0000 056B 000E 000A 4402"            /* .........k...¬D. */
	$"0090 000C 0000 0000 0000 0000 056F 000F"            /* .ê...........o.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0570 000E 000A 4402 0090 000C 0000 0000"            /* .p...¬D..ê...... */
	$"0000 0000 0572 000F 000C 0400 0090 000C"            /* .....r.......ê.. */
	$"0000 0000 0000 0000 0573 000E 000A 4402"            /* .........s...¬D. */
	$"0090 000C 0000 0000 0000 0000 0577 000F"            /* .ê...........w.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0578 000E 000A 4402 0090 000C 0000 0000"            /* .x...¬D..ê...... */
	$"0000 0000 0580 000F 000C 0400 0090 000C"            /* .....Ä.......ê.. */
	$"0000 0000 0000 0000 0581 000E 000A 4402"            /* .........Å...¬D. */
	$"0090 000C 0000 0000 0000 0000 0585 000F"            /* .ê...........Ö.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"058D 000E 000A 4402 0090 000C 0000 0000"            /* .ç...¬D..ê...... */
	$"0000 0000 058F 000F 000C 0400 0090 000C"            /* .....è.......ê.. */
	$"0000 0000 0000 0000 0590 000E 000A 4402"            /* .........ê...¬D. */
	$"0090 000C 0000 0000 0000 0000 0598 000F"            /* .ê...........ò.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0599 000E 000A 4402 0090 000C 0000 0000"            /* .ô...¬D..ê...... */
	$"0000 0000 05A3 000F 000C 0400 0090 000C"            /* .....£.......ê.. */
	$"0000 0000 0000 0000 05A4 000E 000A 4402"            /* .........§...¬D. */
	$"0090 000C 0000 0000 0000 0000 05AE 000F"            /* .ê...........Æ.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"05AF 000E 000A 4402 0090 000C 0000 0000"            /* .Ø...¬D..ê...... */
	$"0000 0000 05B7 000F 000C 0400 0090 000C"            /* .....∑.......ê.. */
	$"0000 0000 0000 0000 05B8 000E 000A 4402"            /* .........∏...¬D. */
	$"0090 000C 0000 0000 0000 0000 05C2 000F"            /* .ê...........¬.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"05C4 000E 000A 4402 0090 000C 0000 0000"            /* .ƒ...¬D..ê...... */
	$"0000 0000 05C8 000F 000C 0400 0090 000C"            /* .....».......ê.. */
	$"0000 0000 0000 0000 05C9 000E 000A 4402"            /* .........…...¬D. */
	$"0090 000C 0000 0000 0000 0000 05D3 000F"            /* .ê...........”.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"05D4 000E 000A 4402 0090 000C 0000 0000"            /* .‘...¬D..ê...... */
	$"0000 0000 05DA 000F 000C 0400 0090 000C"            /* .....⁄.......ê.. */
	$"0000 0000 0000 0000 05DB 000E 000A 4402"            /* .........€...¬D. */
	$"0090 000C 0000 0000 0000 0000 05E1 000F"            /* .ê...........·.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"05E2 000E 000A 4402 0090 000C 0000 0000"            /* .‚...¬D..ê...... */
	$"0000 0000 05EC 000F 000C 0400 0090 000C"            /* .....Ï.......ê.. */
	$"0000 0000 0000 0000 05ED 000E 000A 4402"            /* .........Ì...¬D. */
	$"0090 000C 0000 0000 0000 0000 05F5 000F"            /* .ê...........ı.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"05F6 000E 000A 4402 0090 000C 0000 0000"            /* .ˆ...¬D..ê...... */
	$"0000 0000 05FC 000F 000C 0400 0090 000C"            /* .....¸.......ê.. */
	$"0000 0000 0000 0000 05FD 000E 000A 4402"            /* .........˝...¬D. */
	$"0090 000C 0000 0000 0000 0000 0603 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0604 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 0608 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 060A 000E 000A 4402"            /* .........¬...¬D. */
	$"0090 000C 0000 0000 0000 0000 0610 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0611 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 0619 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 061A 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 061E 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"061F 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 0629 000F 000C 0400 0090 000C"            /* .....).......ê.. */
	$"0000 0000 0000 0000 062A 000E 000A 4402"            /* .........*...¬D. */
	$"0090 000C 0000 0000 0000 0000 0630 000F"            /* .ê...........0.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0631 000E 000A 4402 0090 000C 0000 0000"            /* .1...¬D..ê...... */
	$"0000 0000 063B 000F 000C 0400 0090 000C"            /* .....;.......ê.. */
	$"0000 0000 0000 0000 0641 000E 000A 4402"            /* .........A...¬D. */
	$"0090 000C 0000 0000 0000 0000 0645 000F"            /* .ê...........E.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0647 000E 000A 4402 0090 000C 0000 0000"            /* .G...¬D..ê...... */
	$"0000 0000 064D 000F 000C 0400 0090 000C"            /* .....M.......ê.. */
	$"0000 0000 0000 0000 064E 000E 000A 4402"            /* .........N...¬D. */
	$"0090 000C 0000 0000 0000 0000 0650 000F"            /* .ê...........P.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0651 000E 000A 4402 0090 000C 0000 0000"            /* .Q...¬D..ê...... */
	$"0000 0000 0657 000F 000C 0400 0090 000C"            /* .....W.......ê.. */
	$"0000 0000 0000 0000 0658 000E 000A 4402"            /* .........X...¬D. */
	$"0090 000C 0000 0000 0000 0000 0660 000F"            /* .ê...........`.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0661 000E 000A 4402 0090 000C 0000 0000"            /* .a...¬D..ê...... */
	$"0000 0000 0665 000F 000C 0400 0090 000C"            /* .....e.......ê.. */
	$"0000 0000 0000 0000 0667 000E 000A 4402"            /* .........g...¬D. */
	$"0090 000C 0000 0000 0000 0000 066D 000F"            /* .ê...........m.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"066E 000E 000A 4402 0090 000C 0000 0000"            /* .n...¬D..ê...... */
	$"0000 0000 0672 000F 000C 0400 0090 000C"            /* .....r.......ê.. */
	$"0000 0000 0000 0000 0673 000E 000A 4402"            /* .........s...¬D. */
	$"0090 000C 0000 0000 0000 0000 067B 000F"            /* .ê...........{.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"067C 000E 000A 4402 0090 000C 0000 0000"            /* .|...¬D..ê...... */
	$"0000 0000 0682 000F 000C 0400 0090 000C"            /* .....Ç.......ê.. */
	$"0000 0000 0000 0000 0683 000E 000A 4402"            /* .........É...¬D. */
	$"0090 000C 0000 0000 0000 0000 068D 000F"            /* .ê...........ç.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"068E 000E 000A 4402 0090 000C 0000 0000"            /* .é...¬D..ê...... */
	$"0000 0000 0692 000F 000C 0400 0090 000C"            /* .....í.......ê.. */
	$"0000 0000 0000 0000 0693 000E 000A 4402"            /* .........ì...¬D. */
	$"0090 000C 0000 0000 0000 0000 069B 000F"            /* .ê...........õ.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"069D 000E 000A 4402 0090 000C 0000 0000"            /* .ù...¬D..ê...... */
	$"0000 0000 06A5 000F 000C 0400 0090 000C"            /* .....•.......ê.. */
	$"0000 0000 0000 0000 06A6 000E 000A 4402"            /* .........¶...¬D. */
	$"0090 000C 0000 0000 0000 0000 06AA 000F"            /* .ê...........™.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"06AB 000E 000A 4402 0090 000C 0000 0000"            /* .´...¬D..ê...... */
	$"0000 0000 06AD 000F 000C 0400 0090 000C"            /* .....≠.......ê.. */
	$"0000 0000 0000 0000 06AE 000E 000A 4402"            /* .........Æ...¬D. */
	$"0090 000C 0000 0000 0000 0000 06B0 000F"            /* .ê...........∞.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"06B1 000E 000A 4402 0090 000C 0000 0000"            /* .±...¬D..ê...... */
	$"0000 0000 06B3 000F 000C 0400 0090 000C"            /* .....≥.......ê.. */
	$"0000 0000 0000 0000 06B4 000E 000A 4402"            /* .........¥...¬D. */
	$"0090 000C 0000 0000 0000 0000 06BA 000F"            /* .ê...........∫.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"06BB 000E 000A 4402 0090 000C 0000 0000"            /* .ª...¬D..ê...... */
	$"0000 0000 06BD 000F 000C 0400 0090 000C"            /* .....Ω.......ê.. */
	$"0000 0000 0000 0000 06BE 000E 000A 4402"            /* .........æ...¬D. */
	$"0090 000C 0000 0000 0000 0000 06C4 000F"            /* .ê...........ƒ.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"06C5 000E 000A 4402 0090 000C 0000 0000"            /* .≈...¬D..ê...... */
	$"0000 0000 06C9 000F 000C 0400 0090 000C"            /* .....….......ê.. */
	$"0000 0000 0000 0000 06CA 000E 000A 4402"            /* ......... ...¬D. */
	$"0090 000C 0000 0000 0000 0000 06D2 000F"            /* .ê...........“.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"06D3 000E 000A 4402 0090 000C 0000 0000"            /* .”...¬D..ê...... */
	$"0000 0000 06D7 000F 000C 0400 0090 000C"            /* .....◊.......ê.. */
	$"0000 0000 0000 0000 06D8 000E 000A 4402"            /* .........ÿ...¬D. */
	$"0090 000C 0000 0000 0000 0000 06E0 000F"            /* .ê...........‡.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"06E1 000E 000A 4402 0090 000C 0000 0000"            /* .·...¬D..ê...... */
	$"0000 0000 06E9 000F 000C 0400 0090 000C"            /* .....È.......ê.. */
	$"0000 0000 0000 0000 06EA 000E 000A 4402"            /* .........Í...¬D. */
	$"0090 000C 0000 0000 0000 0000 06F0 000F"            /* .ê............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"06F1 000E 000A 4402 0090 000C 0000 0000"            /* .Ò...¬D..ê...... */
	$"0000 0000 06FB 000F 000C 0400 0090 000C"            /* .....˚.......ê.. */
	$"0000 0000 0000 0000 06FD 000E 000A 4402"            /* .........˝...¬D. */
	$"0090 000C 0000 0000 0000 0000 0703 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0705 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 070B 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 070C 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 0712 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0713 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 0717 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 0718 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 0720 000F"            /* .ê........... .. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0721 000E 000A 4402 0090 000C 0000 0000"            /* .!...¬D..ê...... */
	$"0000 0000 0729 000F 000C 0400 0090 000C"            /* .....).......ê.. */
	$"0000 0000 0000 0000 072A 000E 000A 4402"            /* .........*...¬D. */
	$"0090 000C 0000 0000 0000 0000 0730 000F"            /* .ê...........0.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0736 000E 000A 4402 0090 000C 0000 0000"            /* .6...¬D..ê...... */
	$"0000 0000 073C 000F 000C 0400 0090 000C"            /* .....<.......ê.. */
	$"0000 0000 0000 0000 073E 000E 000A 4402"            /* .........>...¬D. */
	$"0090 000C 0000 0000 0000 0000 0744 000F"            /* .ê...........D.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0745 000E 000A 4402 0090 000C 0000 0000"            /* .E...¬D..ê...... */
	$"0000 0000 074B 000F 000C 0400 0090 000C"            /* .....K.......ê.. */
	$"0000 0000 0000 0000 0754 000E 000A 4402"            /* .........T...¬D. */
	$"0090 000C 0000 0000 0000 0000 0758 000F"            /* .ê...........X.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0759 000E 000A 4402 0090 000C 0000 0000"            /* .Y...¬D..ê...... */
	$"0000 0000 0761 000F 000C 0400 0090 000C"            /* .....a.......ê.. */
	$"0000 0000 0000 0000 0762 000E 000A 4402"            /* .........b...¬D. */
	$"0090 000C 0000 0000 0000 0000 0764 000F"            /* .ê...........d.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0765 000E 000A 4402 0090 000C 0000 0000"            /* .e...¬D..ê...... */
	$"0000 0000 0769 000F 000C 0400 0090 000C"            /* .....i.......ê.. */
	$"0000 0000 0000 0000 076A 000E 000A 4402"            /* .........j...¬D. */
	$"0090 000C 0000 0000 0000 0000 076E 000F"            /* .ê...........n.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"076F 000E 000A 4402 0090 000C 0000 0000"            /* .o...¬D..ê...... */
	$"0000 0000 0773 000F 000C 0400 0090 000C"            /* .....s.......ê.. */
	$"0000 0000 0000 0000 0774 000E 000A 4402"            /* .........t...¬D. */
	$"0090 000C 0000 0000 0000 0000 077C 000F"            /* .ê...........|.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"077D 000E 000A 4402 0090 000C 0000 0000"            /* .}...¬D..ê...... */
	$"0000 0000 0785 000F 000C 0400 0090 000C"            /* .....Ö.......ê.. */
	$"0000 0000 0000 0000 0787 000E 000A 4402"            /* .........á...¬D. */
	$"0090 000C 0000 0000 0000 0000 078B 000F"            /* .ê...........ã.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"078C 000E 000A 4402 0090 000C 0000 0000"            /* .å...¬D..ê...... */
	$"0000 0000 0790 000F 000C 0400 0090 000C"            /* .....ê.......ê.. */
	$"0000 0000 0000 0000 0791 000E 000A 4402"            /* .........ë...¬D. */
	$"0090 000C 0000 0000 0000 0000 0799 000F"            /* .ê...........ô.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"079B 000E 000A 4402 0090 000C 0000 0000"            /* .õ...¬D..ê...... */
	$"0000 0000 079D 000F 000C 0400 0090 000C"            /* .....ù.......ê.. */
	$"0000 0000 0000 0000 079E 000E 000A 4402"            /* .........û...¬D. */
	$"0090 000C 0000 0000 0000 0000 07A4 000F"            /* .ê...........§.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"07A5 000E 000A 4402 0090 000C 0000 0000"            /* .•...¬D..ê...... */
	$"0000 0000 07A9 000F 000C 0400 0090 000C"            /* .....©.......ê.. */
	$"0000 0000 0000 0000 07AA 000E 000A 4402"            /* .........™...¬D. */
	$"0090 000C 0000 0000 0000 0000 07AE 000F"            /* .ê...........Æ.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"07AF 000E 000A 4402 0090 000C 0000 0000"            /* .Ø...¬D..ê...... */
	$"0000 0000 07B3 000F 000C 0400 0090 000C"            /* .....≥.......ê.. */
	$"0000 0000 0000 0000 07B4 000E 000A 4402"            /* .........¥...¬D. */
	$"0090 000C 0000 0000 0000 0000 07BC 000F"            /* .ê...........º.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"07D3 000E 000A 4402 0090 000C 0000 0000"            /* .”...¬D..ê...... */
	$"0000 0000 07D7 000F 000C 0400 0090 000C"            /* .....◊.......ê.. */
	$"0000 0000 0000 0000 07D8 000E 000A 4402"            /* .........ÿ...¬D. */
	$"0090 000C 0000 0000 0000 0000 07E2 000F"            /* .ê...........‚.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"07E4 000E 000A 4402 0090 000C 0000 0000"            /* .‰...¬D..ê...... */
	$"0000 0000 07E6 000F 000C 0400 0090 000C"            /* .....Ê.......ê.. */
	$"0000 0000 0000 0000 07E7 000E 000A 4402"            /* .........Á...¬D. */
	$"0090 000C 0000 0000 0000 0000 07ED 000F"            /* .ê...........Ì.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"07EE 000E 000A 4402 0090 000C 0000 0000"            /* .Ó...¬D..ê...... */
	$"0000 0000 07F4 000F 000C 0400 0090 000C"            /* .....Ù.......ê.. */
	$"0000 0000 0000 0000 07F5 000E 000A 4402"            /* .........ı...¬D. */
	$"0090 000C 0000 0000 0000 0000 07FB 000F"            /* .ê...........˚.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"07FC 000E 000A 4402 0090 000C 0000 0000"            /* .¸...¬D..ê...... */
	$"0000 0000 0800 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 0801 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 0805 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0806 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 0810 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 0811 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 0815 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0816 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 081C 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 081D 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 0823 000F"            /* .ê...........#.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0824 000E 000A 4402 0090 000C 0000 0000"            /* .$...¬D..ê...... */
	$"0000 0000 082C 000F 000C 0400 0090 000C"            /* .....,.......ê.. */
	$"0000 0000 0000 0000 082D 000E 000A 4402"            /* .........-...¬D. */
	$"0090 000C 0000 0000 0000 0000 0833 000F"            /* .ê...........3.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0834 000E 000A 4402 0090 000C 0000 0000"            /* .4...¬D..ê...... */
	$"0000 0000 083A 000F 000C 0400 0090 000C"            /* .....:.......ê.. */
	$"0000 0000 0000 0000 083B 000E 000A 4402"            /* .........;...¬D. */
	$"0090 000C 0000 0000 0000 0000 083D 000F"            /* .ê...........=.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"083E 000E 000A 4402 0090 000C 0000 0000"            /* .>...¬D..ê...... */
	$"0000 0000 0846 000F 000C 0400 0090 000C"            /* .....F.......ê.. */
	$"0000 0000 0000 0000 0848 000E 000A 4402"            /* .........H...¬D. */
	$"0090 000C 0000 0000 0000 0000 084C 000F"            /* .ê...........L.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"084D 000E 000A 4402 0090 000C 0000 0000"            /* .M...¬D..ê...... */
	$"0000 0000 0853 000F 000C 0400 0090 000C"            /* .....S.......ê.. */
	$"0000 0000 0000 0000 0854 000E 000A 4402"            /* .........T...¬D. */
	$"0090 000C 0000 0000 0000 0000 085A 000F"            /* .ê...........Z.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"085B 000E 000A 4402 0090 000C 0000 0000"            /* .[...¬D..ê...... */
	$"0000 0000 085F 000F 000C 0400 0090 000C"            /* ....._.......ê.. */
	$"0000 0000 0000 0000 0868 000E 000A 4402"            /* .........h...¬D. */
	$"0090 000C 0000 0000 0000 0000 086A 000F"            /* .ê...........j.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"086B 000E 000A 4402 0090 000C 0000 0000"            /* .k...¬D..ê...... */
	$"0000 0000 086D 000F 000C 0400 0090 000C"            /* .....m.......ê.. */
	$"0000 0000 0000 0000 086E 000E 000A 4402"            /* .........n...¬D. */
	$"0090 000C 0000 0000 0000 0000 0876 000F"            /* .ê...........v.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0877 000E 000A 4402 0090 000C 0000 0000"            /* .w...¬D..ê...... */
	$"0000 0000 0881 000F 000C 0400 0090 000C"            /* .....Å.......ê.. */
	$"0000 0000 0000 0000 0882 000E 000A 4402"            /* .........Ç...¬D. */
	$"0090 000C 0000 0000 0000 0000 0888 000F"            /* .ê...........à.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0889 000E 000A 4402 0090 000C 0000 0000"            /* .â...¬D..ê...... */
	$"0000 0000 088D 000F 000C 0400 0090 000C"            /* .....ç.......ê.. */
	$"0000 0000 0000 0000 088E 000E 000A 4402"            /* .........é...¬D. */
	$"0090 000C 0000 0000 0000 0000 0894 000F"            /* .ê...........î.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0895 000E 000A 4402 0090 000C 0000 0000"            /* .ï...¬D..ê...... */
	$"0000 0000 089B 000F 000C 0400 0090 000C"            /* .....õ.......ê.. */
	$"0000 0000 0000 0000 089C 000E 000A 4402"            /* .........ú...¬D. */
	$"0090 000C 0000 0000 0000 0000 08A0 000F"            /* .ê...........†.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"08A1 000E 000A 4402 0090 000C 0000 0000"            /* .°...¬D..ê...... */
	$"0000 0000 08A5 000F 000C 0400 0090 000C"            /* .....•.......ê.. */
	$"0000 0000 0000 0000 08A6 000E 000A 4402"            /* .........¶...¬D. */
	$"0090 000C 0000 0000 0000 0000 08AA 000F"            /* .ê...........™.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"08AB 000E 000A 4402 0090 000C 0000 0000"            /* .´...¬D..ê...... */
	$"0000 0000 08B3 000F 000C 0400 0090 000C"            /* .....≥.......ê.. */
	$"0000 0000 0000 0000 08B4 000E 000A 4402"            /* .........¥...¬D. */
	$"0090 000C 0000 0000 0000 0000 08B8 000F"            /* .ê...........∏.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"08B9 000E 000A 4402 0090 000C 0000 0000"            /* .π...¬D..ê...... */
	$"0000 0000 08BF 000F 000C 0400 0090 000C"            /* .....ø.......ê.. */
	$"0000 0000 0000 0000 08C0 000E 000A 4402"            /* .........¿...¬D. */
	$"0090 000C 0000 0000 0000 0000 08C6 000F"            /* .ê...........∆.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"08C7 000E 000A 4402 0090 000C 0000 0000"            /* .«...¬D..ê...... */
	$"0000 0000 08CF 000F 000C 0400 0090 000C"            /* .....œ.......ê.. */
	$"0000 0000 0000 0000 08D0 000E 000A 4402"            /* .........–...¬D. */
	$"0090 000C 0000 0000 0000 0000 08D8 000F"            /* .ê...........ÿ.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"08D9 000E 000A 4402 0090 000C 0000 0000"            /* .Ÿ...¬D..ê...... */
	$"0000 0000 08E1 000F 000C 0400 0090 000C"            /* .....·.......ê.. */
	$"0000 0000 0000 0000 08E2 000E 000A 4402"            /* .........‚...¬D. */
	$"0090 000C 0000 0000 0000 0000 08EC 000F"            /* .ê...........Ï.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"08EE 000E 000A 4402 0090 000C 0000 0000"            /* .Ó...¬D..ê...... */
	$"0000 0000 08F4 000F 000C 0400 0090 000C"            /* .....Ù.......ê.. */
	$"0000 0000 0000 0000 08F5 000E 000A 4402"            /* .........ı...¬D. */
	$"0090 000C 0000 0000 0000 0000 08FB 000F"            /* .ê...........˚.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"08FC 000E 000A 4402 0090 000C 0000 0000"            /* .¸...¬D..ê...... */
	$"0000 0000 0900 000F 000C 0400 0090 000C"            /* ....∆........ê.. */
	$"0000 0000 0000 0000 0901 000E 000A 4402"            /* ........∆....¬D. */
	$"0090 000C 0000 0000 0000 0000 0905 000F"            /* .ê..........∆... */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0906 000E 000A 4402 0090 000C 0000 0000"            /* ∆....¬D..ê...... */
	$"0000 0000 090A 000F 000C 0400 0090 000C"            /* ....∆¬.......ê.. */
	$"0000 0000 0000 0000 090B 000E 000A 4402"            /* ........∆....¬D. */
	$"0090 000C 0000 0000 0000 0000 0911 000F"            /* .ê..........∆... */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0912 000E 000A 4402 0090 000C 0000 0000"            /* ∆....¬D..ê...... */
	$"0000 0000 0918 000F 000C 0400 0090 000C"            /* ....∆........ê.. */
	$"0000 0000 0000 0000 0919 000E 000A 4402"            /* ........∆....¬D. */
	$"0090 000C 0000 0000 0000 0000 091D 000F"            /* .ê..........∆... */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"091F 000E 000A 4402 0090 000C 0000 0000"            /* ∆....¬D..ê...... */
	$"0000 0000 0923 000F 000C 0400 0090 000C"            /* ....∆#.......ê.. */
	$"0000 0000 0000 0000 0925 000E 000A 4402"            /* ........∆%...¬D. */
	$"0090 000C 0000 0000 0000 0000 092B 000F"            /* .ê..........∆+.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"092C 000E 000A 4402 0090 000C 0000 0000"            /* ∆,...¬D..ê...... */
	$"0000 0000 0930 000F 000C 0400 0090 000C"            /* ....∆0.......ê.. */
	$"0000 0000 0000 0000 0931 000E 000A 4402"            /* ........∆1...¬D. */
	$"0090 000C 0000 0000 0000 0000 0935 000F"            /* .ê..........∆5.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0936 000E 000A 4402 0090 000C 0000 0000"            /* ∆6...¬D..ê...... */
	$"0000 0000 093C 000F 000C 0400 0090 000C"            /* ....∆<.......ê.. */
	$"0000 0000 0000 0000 093D 000E 000A 4402"            /* ........∆=...¬D. */
	$"0090 000C 0000 0000 0000 0000 0943 000F"            /* .ê..........∆C.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0944 000E 000A 4402 0090 000C 0000 0000"            /* ∆D...¬D..ê...... */
	$"0000 0000 0948 000F 000C 0400 0090 000C"            /* ....∆H.......ê.. */
	$"0000 0000 0000 0000 0949 000E 000A 4402"            /* ........∆I...¬D. */
	$"0090 000C 0000 0000 0000 0000 094D 000F"            /* .ê..........∆M.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"094E 000E 000A 4402 0090 000C 0000 0000"            /* ∆N...¬D..ê...... */
	$"0000 0000 0954 000F 000C 0400 0090 000C"            /* ....∆T.......ê.. */
	$"0000 0000 0000 0000 0955 000E 000A 4402"            /* ........∆U...¬D. */
	$"0090 000C 0000 0000 0000 0000 0957 000F"            /* .ê..........∆W.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0958 000E 000A 4402 0090 000C 0000 0000"            /* ∆X...¬D..ê...... */
	$"0000 0000 0960 000F 000C 0400 0090 000C"            /* ....∆`.......ê.. */
	$"0000 0000 0000 0000 0962 000E 000A 4402"            /* ........∆b...¬D. */
	$"0090 000C 0000 0000 0000 0000 0964 000F"            /* .ê..........∆d.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0965 000E 000A 4402 0090 000C 0000 0000"            /* ∆e...¬D..ê...... */
	$"0000 0000 096F 000F 000C 0400 0090 000C"            /* ....∆o.......ê.. */
	$"0000 0000 0000 0000 0978 000E 000A 4402"            /* ........∆x...¬D. */
	$"0090 000C 0000 0000 0000 0000 097C 000F"            /* .ê..........∆|.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0984 000E 000A 4402 0090 000C 0000 0000"            /* ∆Ñ...¬D..ê...... */
	$"0000 0000 0986 000F 000C 0400 0090 000C"            /* ....∆Ü.......ê.. */
	$"0000 0000 0000 0000 0987 000E 000A 4402"            /* ........∆á...¬D. */
	$"0090 000C 0000 0000 0000 0000 098F 000F"            /* .ê..........∆è.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0990 000E 000A 4402 0090 000C 0000 0000"            /* ∆ê...¬D..ê...... */
	$"0000 0000 0998 000F 000C 0400 0090 000C"            /* ....∆ò.......ê.. */
	$"0000 0000 0000 0000 0999 000E 000A 4402"            /* ........∆ô...¬D. */
	$"0090 000C 0000 0000 0000 0000 099D 000F"            /* .ê..........∆ù.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"099F 000E 000A 4402 0090 000C 0000 0000"            /* ∆ü...¬D..ê...... */
	$"0000 0000 09A5 000F 000C 0400 0090 000C"            /* ....∆•.......ê.. */
	$"0000 0000 0000 0000 09A6 000E 000A 4402"            /* ........∆¶...¬D. */
	$"0090 000C 0000 0000 0000 0000 09AA 000F"            /* .ê..........∆™.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"09AB 000E 000A 4402 0090 000C 0000 0000"            /* ∆´...¬D..ê...... */
	$"0000 0000 09AF 000F 000C 0400 0090 000C"            /* ....∆Ø.......ê.. */
	$"0000 0000 0000 0000 09B0 000E 000A 4402"            /* ........∆∞...¬D. */
	$"0090 000C 0000 0000 0000 0000 09B6 000F"            /* .ê..........∆∂.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"09B7 000E 000A 4402 0090 000C 0000 0000"            /* ∆∑...¬D..ê...... */
	$"0000 0000 09BD 000F 000C 0400 0090 000C"            /* ....∆Ω.......ê.. */
	$"0000 0000 0000 0000 09BE 000E 000A 4402"            /* ........∆æ...¬D. */
	$"0090 000C 0000 0000 0000 0000 09C4 000F"            /* .ê..........∆ƒ.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"09C5 000E 000A 4402 0090 000C 0000 0000"            /* ∆≈...¬D..ê...... */
	$"0000 0000 09CD 000F 000C 0400 0090 000C"            /* ....∆Õ.......ê.. */
	$"0000 0000 0000 0000 09CE 000E 000A 4402"            /* ........∆Œ...¬D. */
	$"0090 000C 0000 0000 0000 0000 09D6 000F"            /* .ê..........∆÷.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"09D7 000E 000A 4402 0090 000C 0000 0000"            /* ∆◊...¬D..ê...... */
	$"0000 0000 09DF 000F 000C 0400 0090 000C"            /* ....∆ﬂ.......ê.. */
	$"0000 0000 0000 0000 09E5 000E 000A 4402"            /* ........∆Â...¬D. */
	$"0090 000C 0000 0000 0000 0000 09EB 000F"            /* .ê..........∆Î.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"09EC 000E 000A 4402 0090 000C 0000 0000"            /* ∆Ï...¬D..ê...... */
	$"0000 0000 09F0 000F 000C 0400 0090 000C"            /* ....∆.......ê.. */
	$"0000 0000 0000 0000 09F2 000E 000A 4402"            /* ........∆Ú...¬D. */
	$"0090 000C 0000 0000 0000 0000 09F8 000F"            /* .ê..........∆¯.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"09F9 000E 000A 4402 0090 000C 0000 0000"            /* ∆˘...¬D..ê...... */
	$"0000 0000 09FD 000F 000C 0400 0090 000C"            /* ....∆˝.......ê.. */
	$"0000 0000 0000 0000 09FE 000E 000A 4402"            /* ........∆˛...¬D. */
	$"0090 000C 0000 0000 0000 0000 0A04 000F"            /* .ê..........¬... */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0A05 000E 000A 4402 0090 000C 0000 0000"            /* ¬....¬D..ê...... */
	$"0000 0000 0A09 000F 000C 0400 0090 000C"            /* ....¬∆.......ê.. */
	$"0000 0000 0000 0000 0A0B 000E 000A 4402"            /* ........¬....¬D. */
	$"0090 000C 0000 0000 0000 0000 0A0F 000F"            /* .ê..........¬... */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0A10 000E 000A 4402 0090 000C 0000 0000"            /* ¬....¬D..ê...... */
	$"0000 0000 0A16 000F 000C 0400 0090 000C"            /* ....¬........ê.. */
	$"0000 0000 0000 0000 0A18 000E 000A 4402"            /* ........¬....¬D. */
	$"0090 000C 0000 0000 0000 0000 0A22 000F"            /* .ê..........¬".. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0A24 000E 000A 4402 0090 000C 0000 0000"            /* ¬$...¬D..ê...... */
	$"0000 0000 0A2C 000F 000C 0400 0090 000C"            /* ....¬,.......ê.. */
	$"0000 0000 0000 0000 0A2D 000E 000A 4402"            /* ........¬-...¬D. */
	$"0090 000C 0000 0000 0000 0000 0A35 000F"            /* .ê..........¬5.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0A36 000E 000A 4402 0090 000C 0000 0000"            /* ¬6...¬D..ê...... */
	$"0000 0000 0A3A 000F 000C 0400 0090 000C"            /* ....¬:.......ê.. */
	$"0000 0000 0000 0000 0A3B 000E 000A 4402"            /* ........¬;...¬D. */
	$"0090 000C 0000 0000 0000 0000 0A41 000F"            /* .ê..........¬A.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0A53 000E 000A 4402 0090 000C 0000 0000"            /* ¬S...¬D..ê...... */
	$"0000 0000 0A55 000F 000C 0400 0090 000C"            /* ....¬U.......ê.. */
	$"0000 0000 0000 0000 0A56 000E 000A 4402"            /* ........¬V...¬D. */
	$"0090 000C 0000 0000 0000 0000 0A60 000F"            /* .ê..........¬`.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0A61 000E 000A 4402 0090 000C 0000 0000"            /* ¬a...¬D..ê...... */
	$"0000 0000 0A63 000F 000C 0400 0090 000C"            /* ....¬c.......ê.. */
	$"0000 0000 0000 0000 0A64 000E 000A 4402"            /* ........¬d...¬D. */
	$"0090 000C 0000 0000 0000 0000 0A6C 000F"            /* .ê..........¬l.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0A6D 000E 000A 4402 0090 000C 0000 0000"            /* ¬m...¬D..ê...... */
	$"0000 0000 0A77 000F 000C 0400 0090 000C"            /* ....¬w.......ê.. */
	$"0000 0000 0000 0000 0A78 000E 000A 4402"            /* ........¬x...¬D. */
	$"0090 000C 0000 0000 0000 0000 0A7E 000F"            /* .ê..........¬~.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0A7F 000E 000A 4402 0090 000C 0000 0000"            /* ¬....¬D..ê...... */
	$"0000 0000 0A85 000F 000C 0400 0090 000C"            /* ....¬Ö.......ê.. */
	$"0000 0000 0000 0000 0A86 000E 000A 4402"            /* ........¬Ü...¬D. */
	$"0090 000C 0000 0000 0000 0000 0A8E 000F"            /* .ê..........¬é.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0A90 000E 000A 4402 0090 000C 0000 0000"            /* ¬ê...¬D..ê...... */
	$"0000 0000 0A98 000F 000C 0400 0090 000C"            /* ....¬ò.......ê.. */
	$"0000 0000 0000 0000 0A99 000E 000A 4402"            /* ........¬ô...¬D. */
	$"0090 000C 0000 0000 0000 0000 0AA1 000F"            /* .ê..........¬°.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0AA3 000E 000A 4402 0090 000C 0000 0000"            /* ¬£...¬D..ê...... */
	$"0000 0000 0AA7 000F 000C 0400 0090 000C"            /* ....¬ß.......ê.. */
	$"0000 0000 0000 0000 0AA8 000E 000A 4402"            /* ........¬®...¬D. */
	$"0090 000C 0000 0000 0000 0000 0AAE 000F"            /* .ê..........¬Æ.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0AAF 000E 000A 4402 0090 000C 0000 0000"            /* ¬Ø...¬D..ê...... */
	$"0000 0000 0AB7 000F 000C 0400 0090 000C"            /* ....¬∑.......ê.. */
	$"0000 0000 0000 0000 0AB8 000E 000A 4402"            /* ........¬∏...¬D. */
	$"0090 000C 0000 0000 0000 0000 0ABE 000F"            /* .ê..........¬æ.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0ABF 000E 000A 4402 0090 000C 0000 0000"            /* ¬ø...¬D..ê...... */
	$"0000 0000 0AC9 000F 000C 0400 0090 000C"            /* ....¬….......ê.. */
	$"0000 0000 0000 0000 0ACA 000E 000A 4402"            /* ........¬ ...¬D. */
	$"0090 000C 0000 0000 0000 0000 0AD2 000F"            /* .ê..........¬“.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0AD3 000E 000A 4402 0090 000C 0000 0000"            /* ¬”...¬D..ê...... */
	$"0000 0000 0AD9 000F 000C 0400 0090 000C"            /* ....¬Ÿ.......ê.. */
	$"0000 0000 0000 0000 0ADA 000E 000A 4402"            /* ........¬⁄...¬D. */
	$"0090 000C 0000 0000 0000 0000 0AE0 000F"            /* .ê..........¬‡.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0AE1 000E 000A 4402 0090 000C 0000 0000"            /* ¬·...¬D..ê...... */
	$"0000 0000 0AE9 000F 000C 0400 0090 000C"            /* ....¬È.......ê.. */
	$"0000 0000 0000 0000 0AEB 000E 000A 4402"            /* ........¬Î...¬D. */
	$"0090 000C 0000 0000 0000 0000 0AF1 000F"            /* .ê..........¬Ò.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0AF2 000E 000A 4402 0090 000C 0000 0000"            /* ¬Ú...¬D..ê...... */
	$"0000 0000 0AF6 000F 000C 0400 0090 000C"            /* ....¬ˆ.......ê.. */
	$"0000 0000 0000 0000 0AF7 000E 000A 4402"            /* ........¬˜...¬D. */
	$"0090 000C 0000 0000 0000 0000 0AFF 000F"            /* .ê..........¬ˇ.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0B00 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 0B04 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 0B05 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 0B0B 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0B0C 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 0B16 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 0B18 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 0B1E 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0B1F 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 0B23 000F 000C 0400 0090 000C"            /* .....#.......ê.. */
	$"0000 0000 0000 0000 0B24 000E 000A 4402"            /* .........$...¬D. */
	$"0090 000C 0000 0000 0000 0000 0B2A 000F"            /* .ê...........*.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0B2B 000E 000A 4402 0090 000C 0000 0000"            /* .+...¬D..ê...... */
	$"0000 0000 0B2F 000F 000C 0400 0090 000C"            /* ...../.......ê.. */
	$"0000 0000 0000 0000 0B30 000E 000A 4402"            /* .........0...¬D. */
	$"0090 000C 0000 0000 0000 0000 0B36 000F"            /* .ê...........6.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0B37 000E 000A 4402 0090 000C 0000 0000"            /* .7...¬D..ê...... */
	$"0000 0000 0B3B 000F 000C 0400 0090 000C"            /* .....;.......ê.. */
	$"0000 0000 0000 0000 0B3D 000E 000A 4402"            /* .........=...¬D. */
	$"0090 000C 0000 0000 0000 0000 0B43 000F"            /* .ê...........C.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0B44 000E 000A 4402 0090 000C 0000 0000"            /* .D...¬D..ê...... */
	$"0000 0000 0B4A 000F 000C 0400 0090 000C"            /* .....J.......ê.. */
	$"0000 0000 0000 0000 0B4B 000E 000A 4402"            /* .........K...¬D. */
	$"0090 000C 0000 0000 0000 0000 0B4F 000F"            /* .ê...........O.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0B50 000E 000A 4402 0090 000C 0000 0000"            /* .P...¬D..ê...... */
	$"0000 0000 0B52 000F 000C 0400 0090 000C"            /* .....R.......ê.. */
	$"0000 0000 0000 0000 0B53 000E 000A 4402"            /* .........S...¬D. */
	$"0090 000C 0000 0000 0000 0000 0B59 000F"            /* .ê...........Y.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0B5A 000E 000A 4402 0090 000C 0000 0000"            /* .Z...¬D..ê...... */
	$"0000 0000 0B62 000F 000C 0400 0090 000C"            /* .....b.......ê.. */
	$"0000 0000 0000 0000 0B63 000E 000A 4402"            /* .........c...¬D. */
	$"0090 000C 0000 0000 0000 0000 0B69 000F"            /* .ê...........i.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0B6A 000E 000A 4402 0090 000C 0000 0000"            /* .j...¬D..ê...... */
	$"0000 0000 0B72 000F 000C 0400 0090 000C"            /* .....r.......ê.. */
	$"0000 0000 0000 0000 0B73 000E 000A 4402"            /* .........s...¬D. */
	$"0090 000C 0000 0000 0000 0000 0B79 000F"            /* .ê...........y.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0B7A 000E 000A 4402 0090 000C 0000 0000"            /* .z...¬D..ê...... */
	$"0000 0000 0B84 000F 000C 0400 0090 000C"            /* .....Ñ.......ê.. */
	$"0000 0000 0000 0000 0B86 000E 000A 4402"            /* .........Ü...¬D. */
	$"0090 000C 0000 0000 0000 0000 0B8C 000F"            /* .ê...........å.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0B8D 000E 000A 4402 0090 000C 0000 0000"            /* .ç...¬D..ê...... */
	$"0000 0000 0B97 000F 000C 0400 0090 000C"            /* .....ó.......ê.. */
	$"0000 0000 0000 0000 0B98 000E 000A 4402"            /* .........ò...¬D. */
	$"0090 000C 0000 0000 0000 0000 0BA0 000F"            /* .ê...........†.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0BA1 000E 000A 4402 0090 000C 0000 0000"            /* .°...¬D..ê...... */
	$"0000 0000 0BA9 000F 000C 0400 0090 000C"            /* .....©.......ê.. */
	$"0000 0000 0000 0000 0BAA 000E 000A 4402"            /* .........™...¬D. */
	$"0090 000C 0000 0000 0000 0000 0BB0 000F"            /* .ê...........∞.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0BB1 000E 000A 4402 0090 000C 0000 0000"            /* .±...¬D..ê...... */
	$"0000 0000 0BB9 000F 000C 0400 0090 000C"            /* .....π.......ê.. */
	$"0000 0000 0000 0000 0BBA 000E 000A 4402"            /* .........∫...¬D. */
	$"0090 000C 0000 0000 0000 0000 0BC0 000F"            /* .ê...........¿.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0BC1 000E 000A 4402 0090 000C 0000 0000"            /* .¡...¬D..ê...... */
	$"0000 0000 0BC9 000F 000C 0400 0090 000C"            /* .....….......ê.. */
	$"0000 0000 0000 0000 0BCA 000E 000A 4402"            /* ......... ...¬D. */
	$"0090 000C 0000 0000 0000 0000 0BD4 000F"            /* .ê...........‘.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0BD6 000E 000A 4402 0090 000C 0000 0000"            /* .÷...¬D..ê...... */
	$"0000 0000 0BDA 000F 000C 0400 0090 000C"            /* .....⁄.......ê.. */
	$"0000 0000 0000 0000 0BDB 000E 000A 4402"            /* .........€...¬D. */
	$"0090 000C 0000 0000 0000 0000 0BE7 000F"            /* .ê...........Á.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0BE8 000E 000A 4402 0090 000C 0000 0000"            /* .Ë...¬D..ê...... */
	$"0000 0000 0BEE 000F 000C 0400 0090 000C"            /* .....Ó.......ê.. */
	$"0000 0000 0000 0000 0BEF 000E 000A 4402"            /* .........Ô...¬D. */
	$"0090 000C 0000 0000 0000 0000 0BF5 000F"            /* .ê...........ı.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0BF6 000E 000A 4402 0090 000C 0000 0000"            /* .ˆ...¬D..ê...... */
	$"0000 0000 0BFA 000F 000C 0400 0090 000C"            /* .....˙.......ê.. */
	$"0000 0000 0000 0000 0BFB 000E 000A 4402"            /* .........˚...¬D. */
	$"0090 000C 0000 0000 0000 0000 0BFF 000F"            /* .ê...........ˇ.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0C00 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 0C06 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 0C07 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 0C0F 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0C10 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 0C18 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 0C1A 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 0C20 000F"            /* .ê........... .. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0C21 000E 000A 4402 0090 000C 0000 0000"            /* .!...¬D..ê...... */
	$"0000 0000 0C27 000F 000C 0400 0090 000C"            /* .....'.......ê.. */
	$"0000 0000 0000 0000 0C28 000E 000A 4402"            /* .........(...¬D. */
	$"0090 000C 0000 0000 0000 0000 0C30 000F"            /* .ê...........0.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0C31 000E 000A 4402 0090 000C 0000 0000"            /* .1...¬D..ê...... */
	$"0000 0000 0C39 000F 000C 0400 0090 000C"            /* .....9.......ê.. */
	$"0000 0000 0000 0000 0C3A 000E 000A 4402"            /* .........:...¬D. */
	$"0090 000C 0000 0000 0000 0000 0C3E 000F"            /* .ê...........>.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0C3F 000E 000A 4402 0090 000C 0000 0000"            /* .?...¬D..ê...... */
	$"0000 0000 0C43 000F 000C 0400 0090 000C"            /* .....C.......ê.. */
	$"0000 0000 0000 0000 0C44 000E 000A 4402"            /* .........D...¬D. */
	$"0090 000C 0000 0000 0000 0000 0C4C 000F"            /* .ê...........L.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0C52 000E 000A 4402 0090 000C 0000 0000"            /* .R...¬D..ê...... */
	$"0000 0000 0C58 000F 000C 0400 0090 000C"            /* .....X.......ê.. */
	$"0000 0000 0000 0000 0C59 000E 000A 4402"            /* .........Y...¬D. */
	$"0090 000C 0000 0000 0000 0000 0C5D 000F"            /* .ê...........].. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0C5F 000E 000A 4402 0090 000C 0000 0000"            /* ._...¬D..ê...... */
	$"0000 0000 0C67 000F 000C 0400 0090 000C"            /* .....g.......ê.. */
	$"0000 0000 0000 0000 0C68 000E 000A 4402"            /* .........h...¬D. */
	$"0090 000C 0000 0000 0000 0000 0C70 000F"            /* .ê...........p.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0C71 000E 000A 4402 0090 000C 0000 0000"            /* .q...¬D..ê...... */
	$"0000 0000 0C77 000F 000C 0400 0090 000C"            /* .....w.......ê.. */
	$"0000 0000 0000 0000 0C78 000E 000A 4402"            /* .........x...¬D. */
	$"0090 000C 0000 0000 0000 0000 0C80 000F"            /* .ê...........Ä.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0C92 000E 000A 4402 0090 000C 0000 0000"            /* .í...¬D..ê...... */
	$"0000 0000 0C94 000F 000C 0400 0090 000C"            /* .....î.......ê.. */
	$"0000 0000 0000 0000 0C95 000E 000A 4402"            /* .........ï...¬D. */
	$"0090 000C 0000 0000 0000 0000 0C9F 000F"            /* .ê...........ü.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0CA1 000E 000A 4402 0090 000C 0000 0000"            /* .°...¬D..ê...... */
	$"0000 0000 0CA7 000F 000C 0400 0090 000C"            /* .....ß.......ê.. */
	$"0000 0000 0000 0000 0CA9 000E 000A 4402"            /* .........©...¬D. */
	$"0090 000C 0000 0000 0000 0000 0CB1 000F"            /* .ê...........±.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0CB2 000E 000A 4402 0090 000C 0000 0000"            /* .≤...¬D..ê...... */
	$"0000 0000 0CBA 000F 000C 0400 0090 000C"            /* .....∫.......ê.. */
	$"0000 0000 0000 0000 0CBC 000E 000A 4402"            /* .........º...¬D. */
	$"0090 000C 0000 0000 0000 0000 0CC4 000F"            /* .ê...........ƒ.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0CC5 000E 000A 4402 0090 000C 0000 0000"            /* .≈...¬D..ê...... */
	$"0000 0000 0CC7 000F 000C 0400 0090 000C"            /* .....«.......ê.. */
	$"0000 0000 0000 0000 0CC8 000E 000A 4402"            /* .........»...¬D. */
	$"0090 000C 0000 0000 0000 0000 0CD0 000F"            /* .ê...........–.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0CD1 000E 000A 4402 0090 000C 0000 0000"            /* .—...¬D..ê...... */
	$"0000 0000 0CD9 000F 000C 0400 0090 000C"            /* .....Ÿ.......ê.. */
	$"0000 0000 0000 0000 0CEA 000E 000A 4402"            /* .........Í...¬D. */
	$"0090 000C 0000 0000 0000 0000 0CEC 000F"            /* .ê...........Ï.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0CED 000E 000A 4402 0090 000C 0000 0000"            /* .Ì...¬D..ê...... */
	$"0000 0000 0CEF 000F 000C 0400 0090 000C"            /* .....Ô.......ê.. */
	$"0000 0000 0000 0000 0CF0 000E 000A 4402"            /* ............¬D. */
	$"0090 000C 0000 0000 0000 0000 0CF4 000F"            /* .ê...........Ù.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0CF6 000E 000A 4402 0090 000C 0000 0000"            /* .ˆ...¬D..ê...... */
	$"0000 0000 0CFC 000F 000C 0400 0090 000C"            /* .....¸.......ê.. */
	$"0000 0000 0000 0000 0CFD 000E 000A 4402"            /* .........˝...¬D. */
	$"0090 000C 0000 0000 0000 0000 0D01 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0D02 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 0D06 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 0D07 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 0D0B 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0D0C 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 0D10 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 0D11 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 0D1B 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0D1C 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 0D22 000F 000C 0400 0090 000C"            /* .....".......ê.. */
	$"0000 0000 0000 0000 0D23 000E 000A 4402"            /* .........#...¬D. */
	$"0090 000C 0000 0000 0000 0000 0D2D 000F"            /* .ê...........-.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0D2F 000E 000A 4402 0090 000C 0000 0000"            /* ./...¬D..ê...... */
	$"0000 0000 0D31 000F 000C 0400 0090 000C"            /* .....1.......ê.. */
	$"0000 0000 0000 0000 0D32 000E 000A 4402"            /* .........2...¬D. */
	$"0090 000C 0000 0000 0000 0000 0D3A 000F"            /* .ê...........:.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0D3B 000E 000A 4402 0090 000C 0000 0000"            /* .;...¬D..ê...... */
	$"0000 0000 0D41 000F 000C 0400 0090 000C"            /* .....A.......ê.. */
	$"0000 0000 0000 0000 0D42 000E 000A 4402"            /* .........B...¬D. */
	$"0090 000C 0000 0000 0000 0000 0D4E 000F"            /* .ê...........N.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0D4F 000E 000A 4402 0090 000C 0000 0000"            /* .O...¬D..ê...... */
	$"0000 0000 0D57 000F 000C 0400 0090 000C"            /* .....W.......ê.. */
	$"0000 0000 0000 0000 0D58 000E 000A 4402"            /* .........X...¬D. */
	$"0090 000C 0000 0000 0000 0000 0D60 000F"            /* .ê...........`.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0D61 000E 000A 4402 0090 000C 0000 0000"            /* .a...¬D..ê...... */
	$"0000 0000 0D65 000F 000C 0400 0090 000C"            /* .....e.......ê.. */
	$"0000 0000 0000 0000 0D66 000E 000A 4402"            /* .........f...¬D. */
	$"0090 000C 0000 0000 0000 0000 0D6A 000F"            /* .ê...........j.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0D6C 000E 000A 4402 0090 000C 0000 0000"            /* .l...¬D..ê...... */
	$"0000 0000 0D70 000F 000C 0400 0090 000C"            /* .....p.......ê.. */
	$"0000 0000 0000 0000 0D72 000E 000A 4402"            /* .........r...¬D. */
	$"0090 000C 0000 0000 0000 0000 0D78 000F"            /* .ê...........x.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0D79 000E 000A 4402 0090 000C 0000 0000"            /* .y...¬D..ê...... */
	$"0000 0000 0D7D 000F 000C 0400 0090 000C"            /* .....}.......ê.. */
	$"0000 0000 0000 0000 0D7E 000E 000A 4402"            /* .........~...¬D. */
	$"0090 000C 0000 0000 0000 0000 0D84 000F"            /* .ê...........Ñ.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0D85 000E 000A 4402 0090 000C 0000 0000"            /* .Ö...¬D..ê...... */
	$"0000 0000 0D89 000F 000C 0400 0090 000C"            /* .....â.......ê.. */
	$"0000 0000 0000 0000 0D8A 000E 000A 4402"            /* .........ä...¬D. */
	$"0090 000C 0000 0000 0000 0000 0D90 000F"            /* .ê...........ê.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0D91 000E 000A 4402 0090 000C 0000 0000"            /* .ë...¬D..ê...... */
	$"0000 0000 0D95 000F 000C 0400 0090 000C"            /* .....ï.......ê.. */
	$"0000 0000 0000 0000 0D97 000E 000A 4402"            /* .........ó...¬D. */
	$"0090 000C 0000 0000 0000 0000 0D9B 000F"            /* .ê...........õ.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0D9C 000E 000A 4402 0090 000C 0000 0000"            /* .ú...¬D..ê...... */
	$"0000 0000 0DA0 000F 000C 0400 0090 000C"            /* .....†.......ê.. */
	$"0000 0000 0000 0000 0DA2 000E 000A 4402"            /* .........¢...¬D. */
	$"0090 000C 0000 0000 0000 0000 0DA6 000F"            /* .ê...........¶.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0DA7 000E 000A 4402 0090 000C 0000 0000"            /* .ß...¬D..ê...... */
	$"0000 0000 0DAB 000F 000C 0400 0090 000C"            /* .....´.......ê.. */
	$"0000 0000 0000 0000 0DAD 000E 000A 4402"            /* .........≠...¬D. */
	$"0090 000C 0000 0000 0000 0000 0DB3 000F"            /* .ê...........≥.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0DB4 000E 000A 4402 0090 000C 0000 0000"            /* .¥...¬D..ê...... */
	$"0000 0000 0DB8 000F 000C 0400 0090 000C"            /* .....∏.......ê.. */
	$"0000 0000 0000 0000 0DBA 000E 000A 4402"            /* .........∫...¬D. */
	$"0090 000C 0000 0000 0000 0000 0DBC 000F"            /* .ê...........º.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0DBD 000E 000A 4402 0090 000C 0000 0000"            /* .Ω...¬D..ê...... */
	$"0000 0000 0DC3 000F 000C 0400 0090 000C"            /* .....√.......ê.. */
	$"0000 0000 0000 0000 0DC4 000E 000A 4402"            /* .........ƒ...¬D. */
	$"0090 000C 0000 0000 0000 0000 0DC8 000F"            /* .ê...........».. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0DC9 000E 000A 4402 0090 000C 0000 0000"            /* .…...¬D..ê...... */
	$"0000 0000 0DCD 000F 000C 0400 0090 000C"            /* .....Õ.......ê.. */
	$"0000 0000 0000 0000 0DCE 000E 000A 4402"            /* .........Œ...¬D. */
	$"0090 000C 0000 0000 0000 0000 0DD8 000F"            /* .ê...........ÿ.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0DD9 000E 000A 4402 0090 000C 0000 0000"            /* .Ÿ...¬D..ê...... */
	$"0000 0000 0DDD 000F 000C 0400 0090 000C"            /* .....›.......ê.. */
	$"0000 0000 0000 0000 0DDE 000E 000A 4402"            /* .........ﬁ...¬D. */
	$"0090 000C 0000 0000 0000 0000 0DE2 000F"            /* .ê...........‚.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0DE3 000E 000A 4402 0090 000C 0000 0000"            /* .„...¬D..ê...... */
	$"0000 0000 0DE7 000F 000C 0400 0090 000C"            /* .....Á.......ê.. */
	$"0000 0000 0000 0000 0DE8 000E 000A 4402"            /* .........Ë...¬D. */
	$"0090 000C 0000 0000 0000 0000 0DEA 000F"            /* .ê...........Í.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0DEB 000E 000A 4402 0090 000C 0000 0000"            /* .Î...¬D..ê...... */
	$"0000 0000 0DEF 000F 000C 0400 0090 000C"            /* .....Ô.......ê.. */
	$"0000 0000 0000 0000 0DF0 000E 000A 4402"            /* ............¬D. */
	$"0090 000C 0000 0000 0000 0000 0DF4 000F"            /* .ê...........Ù.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0DF5 000E 000A 4402 0090 000C 0000 0000"            /* .ı...¬D..ê...... */
	$"0000 0000 0DFD 000F 000C 0400 0090 000C"            /* .....˝.......ê.. */
	$"0000 0000 0000 0000 0DFE 000E 000A 4402"            /* .........˛...¬D. */
	$"0090 000C 0000 0000 0000 0000 0E04 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0E05 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 0E09 000F 000C 0400 0090 000C"            /* .....∆.......ê.. */
	$"0000 0000 0000 0000 0E0A 000E 000A 4402"            /* .........¬...¬D. */
	$"0090 000C 0000 0000 0000 0000 0E10 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0E11 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 0E19 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 0E1A 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 0E22 000F"            /* .ê...........".. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0E23 000E 000A 4402 0090 000C 0000 0000"            /* .#...¬D..ê...... */
	$"0000 0000 0E29 000F 000C 0400 0090 000C"            /* .....).......ê.. */
	$"0000 0000 0000 0000 0E2B 000E 000A 4402"            /* .........+...¬D. */
	$"0090 000C 0000 0000 0000 0000 0E35 000F"            /* .ê...........5.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0E36 000E 000A 4402 0090 000C 0000 0000"            /* .6...¬D..ê...... */
	$"0000 0000 0E3A 000F 000C 0400 0090 000C"            /* .....:.......ê.. */
	$"0000 0000 0000 0000 0E3B 000E 000A 4402"            /* .........;...¬D. */
	$"0090 000C 0000 0000 0000 0000 0E41 000F"            /* .ê...........A.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0E42 000E 000A 4402 0090 000C 0000 0000"            /* .B...¬D..ê...... */
	$"0000 0000 0E48 000F 000C 0400 0090 000C"            /* .....H.......ê.. */
	$"0000 0000 0000 0000 0E49 000E 000A 4402"            /* .........I...¬D. */
	$"0090 000C 0000 0000 0000 0000 0E4B 000F"            /* .ê...........K.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0E4C 000E 000A 4402 0090 000C 0000 0000"            /* .L...¬D..ê...... */
	$"0000 0000 0E52 000F 000C 0400 0090 000C"            /* .....R.......ê.. */
	$"0000 0000 0000 0000 0E54 000E 000A 4402"            /* .........T...¬D. */
	$"0090 000C 0000 0000 0000 0000 0E5C 000F"            /* .ê...........\.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0E5D 000E 000A 4402 0090 000C 0000 0000"            /* .]...¬D..ê...... */
	$"0000 0000 0E61 000F 000C 0400 0090 000C"            /* .....a.......ê.. */
	$"0000 0000 0000 0000 0E62 000E 000A 4402"            /* .........b...¬D. */
	$"0090 000C 0000 0000 0000 0000 0E66 000F"            /* .ê...........f.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0E67 000E 000A 4402 0090 000C 0000 0000"            /* .g...¬D..ê...... */
	$"0000 0000 0E6F 000F 000C 0400 0090 000C"            /* .....o.......ê.. */
	$"0000 0000 0000 0000 0E70 000E 000A 4402"            /* .........p...¬D. */
	$"0090 000C 0000 0000 0000 0000 0E74 000F"            /* .ê...........t.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0E75 000E 000A 4402 0090 000C 0000 0000"            /* .u...¬D..ê...... */
	$"0000 0000 0E7D 000F 000C 0400 0090 000C"            /* .....}.......ê.. */
	$"0000 0000 0000 0000 0E7F 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 0E81 000F"            /* .ê...........Å.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0E82 000E 000A 4402 0090 000C 0000 0000"            /* .Ç...¬D..ê...... */
	$"0000 0000 0E88 000F 000C 0400 0090 000C"            /* .....à.......ê.. */
	$"0000 0000 0000 0000 0E89 000E 000A 4402"            /* .........â...¬D. */
	$"0090 000C 0000 0000 0000 0000 0E8D 000F"            /* .ê...........ç.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0E9B 000E 000A 4402 0090 000C 0000 0000"            /* .õ...¬D..ê...... */
	$"0000 0000 0E9D 000F 000C 0400 0090 000C"            /* .....ù.......ê.. */
	$"0000 0000 0000 0000 0E9E 000E 000A 4402"            /* .........û...¬D. */
	$"0090 000C 0000 0000 0000 0000 0EA6 000F"            /* .ê...........¶.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0EA7 000E 000A 4402 0090 000C 0000 0000"            /* .ß...¬D..ê...... */
	$"0000 0000 0EAB 000F 000C 0400 0090 000C"            /* .....´.......ê.. */
	$"0000 0000 0000 0000 0EAC 000E 000A 4402"            /* .........¨...¬D. */
	$"0090 000C 0000 0000 0000 0000 0EAE 000F"            /* .ê...........Æ.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0EAF 000E 000A 4402 0090 000C 0000 0000"            /* .Ø...¬D..ê...... */
	$"0000 0000 0EB5 000F 000C 0400 0090 000C"            /* .....µ.......ê.. */
	$"0000 0000 0000 0000 0EB6 000E 000A 4402"            /* .........∂...¬D. */
	$"0090 000C 0000 0000 0000 0000 0EBA 000F"            /* .ê...........∫.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0EBF 000E 000A 4402 0090 000C 0000 0000"            /* .ø...¬D..ê...... */
	$"0000 0000 0EC3 000F 000C 0400 0090 000C"            /* .....√.......ê.. */
	$"0000 0000 0000 0000 0EC4 000E 000A 4402"            /* .........ƒ...¬D. */
	$"0090 000C 0000 0000 0000 0000 0EC6 000F"            /* .ê...........∆.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0EC7 000E 000A 4402 0090 000C 0000 0000"            /* .«...¬D..ê...... */
	$"0000 0000 0ECD 000F 000C 0400 0090 000C"            /* .....Õ.......ê.. */
	$"0000 0000 0000 0000 0ECE 000E 000A 4402"            /* .........Œ...¬D. */
	$"0090 000C 0000 0000 0000 0000 0ED0 000F"            /* .ê...........–.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0ED1 000E 000A 4402 0090 000C 0000 0000"            /* .—...¬D..ê...... */
	$"0000 0000 0EDB 000F 000C 0400 0090 000C"            /* .....€.......ê.. */
	$"0000 0000 0000 0000 0EDC 000E 000A 4402"            /* .........‹...¬D. */
	$"0090 000C 0000 0000 0000 0000 0EE0 000F"            /* .ê...........‡.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0EE1 000E 000A 4402 0090 000C 0000 0000"            /* .·...¬D..ê...... */
	$"0000 0000 0EE7 000F 000C 0400 0090 000C"            /* .....Á.......ê.. */
	$"0000 0000 0000 0000 0EE8 000E 000A 4402"            /* .........Ë...¬D. */
	$"0090 000C 0000 0000 0000 0000 0EEE 000F"            /* .ê...........Ó.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0EEF 000E 000A 4402 0090 000C 0000 0000"            /* .Ô...¬D..ê...... */
	$"0000 0000 0EF1 000F 000C 0400 0090 000C"            /* .....Ò.......ê.. */
	$"0000 0000 0000 0000 0EF2 000E 000A 4402"            /* .........Ú...¬D. */
	$"0090 000C 0000 0000 0000 0000 0EF4 000F"            /* .ê...........Ù.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0EF5 000E 000A 4402 0090 000C 0000 0000"            /* .ı...¬D..ê...... */
	$"0000 0000 0EF9 000F 000C 0400 0090 000C"            /* .....˘.......ê.. */
	$"0000 0000 0000 0000 0EFA 000E 000A 4402"            /* .........˙...¬D. */
	$"0090 000C 0000 0000 0000 0000 0F00 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0F01 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 0F09 000F 000C 0400 0090 000C"            /* .....∆.......ê.. */
	$"0000 0000 0000 0000 0F0A 000E 000A 4402"            /* .........¬...¬D. */
	$"0090 000C 0000 0000 0000 0000 0F12 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0F14 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 0F18 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 0F19 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 0F25 000F"            /* .ê...........%.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0F26 000E 000A 4402 0090 000C 0000 0000"            /* .&...¬D..ê...... */
	$"0000 0000 0F2C 000F 000C 0400 0090 000C"            /* .....,.......ê.. */
	$"0000 0000 0000 0000 0F2E 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 0F34 000F"            /* .ê...........4.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0F35 000E 000A 4402 0090 000C 0000 0000"            /* .5...¬D..ê...... */
	$"0000 0000 0F39 000F 000C 0400 0090 000C"            /* .....9.......ê.. */
	$"0000 0000 0000 0000 0F3A 000E 000A 4402"            /* .........:...¬D. */
	$"0090 000C 0000 0000 0000 0000 0F3E 000F"            /* .ê...........>.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0F3F 000E 000A 4402 0090 000C 0000 0000"            /* .?...¬D..ê...... */
	$"0000 0000 0F45 000F 000C 0400 0090 000C"            /* .....E.......ê.. */
	$"0000 0000 0000 0000 0F46 000E 000A 4402"            /* .........F...¬D. */
	$"0090 000C 0000 0000 0000 0000 0F4A 000F"            /* .ê...........J.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0F4B 000E 000A 4402 0090 000C 0000 0000"            /* .K...¬D..ê...... */
	$"0000 0000 0F4F 000F 000C 0400 0090 000C"            /* .....O.......ê.. */
	$"0000 0000 0000 0000 0F50 000E 000A 4402"            /* .........P...¬D. */
	$"0090 000C 0000 0000 0000 0000 0F56 000F"            /* .ê...........V.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0F57 000E 000A 4402 0090 000C 0000 0000"            /* .W...¬D..ê...... */
	$"0000 0000 0F5F 000F 000C 0400 0090 000C"            /* ....._.......ê.. */
	$"0000 0000 0000 0000 0F60 000E 000A 4402"            /* .........`...¬D. */
	$"0090 000C 0000 0000 0000 0000 0F68 000F"            /* .ê...........h.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0F6A 000E 000A 4402 0090 000C 0000 0000"            /* .j...¬D..ê...... */
	$"0000 0000 0F70 000F 000C 0400 0090 000C"            /* .....p.......ê.. */
	$"0000 0000 0000 0000 0F71 000E 000A 4402"            /* .........q...¬D. */
	$"0090 000C 0000 0000 0000 0000 0F75 000F"            /* .ê...........u.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0F76 000E 000A 4402 0090 000C 0000 0000"            /* .v...¬D..ê...... */
	$"0000 0000 0F78 000F 000C 0400 0090 000C"            /* .....x.......ê.. */
	$"0000 0000 0000 0000 0F79 000E 000A 4402"            /* .........y...¬D. */
	$"0090 000C 0000 0000 0000 0000 0F7F 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0F80 000E 000A 4402 0090 000C 0000 0000"            /* .Ä...¬D..ê...... */
	$"0000 0000 0F88 000F 000C 0400 0090 000C"            /* .....à.......ê.. */
	$"0000 0000 0000 0000 0F89 000E 000A 4402"            /* .........â...¬D. */
	$"0090 000C 0000 0000 0000 0000 0F91 000F"            /* .ê...........ë.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0F92 000E 000A 4402 0090 000C 0000 0000"            /* .í...¬D..ê...... */
	$"0000 0000 0F96 000F 000C 0400 0090 000C"            /* .....ñ.......ê.. */
	$"0000 0000 0000 0000 0F97 000E 000A 4402"            /* .........ó...¬D. */
	$"0090 000C 0000 0000 0000 0000 0F9B 000F"            /* .ê...........õ.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0F9C 000E 000A 4402 0090 000C 0000 0000"            /* .ú...¬D..ê...... */
	$"0000 0000 0FA4 000F 000C 0400 0090 000C"            /* .....§.......ê.. */
	$"0000 0000 0000 0000 0FAA 000E 000A 4402"            /* .........™...¬D. */
	$"0090 000C 0000 0000 0000 0000 0FAE 000F"            /* .ê...........Æ.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0FAF 000E 000A 4402 0090 000C 0000 0000"            /* .Ø...¬D..ê...... */
	$"0000 0000 0FB3 000F 000C 0400 0090 000C"            /* .....≥.......ê.. */
	$"0000 0000 0000 0000 0FB5 000E 000A 4402"            /* .........µ...¬D. */
	$"0090 000C 0000 0000 0000 0000 0FB7 000F"            /* .ê...........∑.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0FB8 000E 000A 4402 0090 000C 0000 0000"            /* .∏...¬D..ê...... */
	$"0000 0000 0FC2 000F 000C 0400 0090 000C"            /* .....¬.......ê.. */
	$"0000 0000 0000 0000 0FC3 000E 000A 4402"            /* .........√...¬D. */
	$"0090 000C 0000 0000 0000 0000 0FCB 000F"            /* .ê...........À.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0FCC 000E 000A 4402 0090 000C 0000 0000"            /* .Ã...¬D..ê...... */
	$"0000 0000 0FD0 000F 000C 0400 0090 000C"            /* .....–.......ê.. */
	$"0000 0000 0000 0000 0FD1 000E 000A 4402"            /* .........—...¬D. */
	$"0090 000C 0000 0000 0000 0000 0FD5 000F"            /* .ê...........’.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0FD6 000E 000A 4402 0090 000C 0000 0000"            /* .÷...¬D..ê...... */
	$"0000 0000 0FDC 000F 000C 0400 0090 000C"            /* .....‹.......ê.. */
	$"0000 0000 0000 0000 0FDD 000E 000A 4402"            /* .........›...¬D. */
	$"0090 000C 0000 0000 0000 0000 0FE3 000F"            /* .ê...........„.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0FE4 000E 000A 4402 0090 000C 0000 0000"            /* .‰...¬D..ê...... */
	$"0000 0000 0FEC 000F 000C 0400 0090 000C"            /* .....Ï.......ê.. */
	$"0000 0000 0000 0000 0FEE 000E 000A 4402"            /* .........Ó...¬D. */
	$"0090 000C 0000 0000 0000 0000 0FF4 000F"            /* .ê...........Ù.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0FF5 000E 000A 4402 0090 000C 0000 0000"            /* .ı...¬D..ê...... */
	$"0000 0000 0FF9 000F 000C 0400 0090 000C"            /* .....˘.......ê.. */
	$"0000 0000 0000 0000 0FFA 000E 000A 4402"            /* .........˙...¬D. */
	$"0090 000C 0000 0000 0000 0000 0FFC 000F"            /* .ê...........¸.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0FFD 000E 000A 4402 0090 000C 0000 0000"            /* .˝...¬D..ê...... */
	$"0000 0000 1003 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 1004 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 100A 000F"            /* .ê...........¬.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"100B 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 1013 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 1014 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 101C 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"101E 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 1022 000F 000C 0400 0090 000C"            /* .....".......ê.. */
	$"0000 0000 0000 0000 1023 000E 000A 4402"            /* .........#...¬D. */
	$"0090 000C 0000 0000 0000 0000 1029 000F"            /* .ê...........).. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"102A 000E 000A 4402 0090 000C 0000 0000"            /* .*...¬D..ê...... */
	$"0000 0000 102E 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 102F 000E 000A 4402"            /* ........./...¬D. */
	$"0090 000C 0000 0000 0000 0000 1035 000F"            /* .ê...........5.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1036 000E 000A 4402 0090 000C 0000 0000"            /* .6...¬D..ê...... */
	$"0000 0000 103A 000F 000C 0400 0090 000C"            /* .....:.......ê.. */
	$"0000 0000 0000 0000 103C 000E 000A 4402"            /* .........<...¬D. */
	$"0090 000C 0000 0000 0000 0000 1040 000F"            /* .ê...........@.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1041 000E 000A 4402 0090 000C 0000 0000"            /* .A...¬D..ê...... */
	$"0000 0000 1043 000F 000C 0400 0090 000C"            /* .....C.......ê.. */
	$"0000 0000 0000 0000 1044 000E 000A 4402"            /* .........D...¬D. */
	$"0090 000C 0000 0000 0000 0000 104A 000F"            /* .ê...........J.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"104B 000E 000A 4402 0090 000C 0000 0000"            /* .K...¬D..ê...... */
	$"0000 0000 1053 000F 000C 0400 0090 000C"            /* .....S.......ê.. */
	$"0000 0000 0000 0000 1054 000E 000A 4402"            /* .........T...¬D. */
	$"0090 000C 0000 0000 0000 0000 105A 000F"            /* .ê...........Z.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1060 000E 000A 4402 0090 000C 0000 0000"            /* .`...¬D..ê...... */
	$"0000 0000 1068 000F 000C 0400 0090 000C"            /* .....h.......ê.. */
	$"0000 0000 0000 0000 1069 000E 000A 4402"            /* .........i...¬D. */
	$"0090 000C 0000 0000 0000 0000 106D 000F"            /* .ê...........m.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"106E 000E 000A 4402 0090 000C 0000 0000"            /* .n...¬D..ê...... */
	$"0000 0000 107A 000F 000C 0400 0090 000C"            /* .....z.......ê.. */
	$"0000 0000 0000 0000 107C 000E 000A 4402"            /* .........|...¬D. */
	$"0090 000C 0000 0000 0000 0000 1082 000F"            /* .ê...........Ç.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1092 000E 000A 4402 0090 000C 0000 0000"            /* .í...¬D..ê...... */
	$"0000 0000 1094 000F 000C 0400 0090 000C"            /* .....î.......ê.. */
	$"0000 0000 0000 0000 1095 000E 000A 4402"            /* .........ï...¬D. */
	$"0090 000C 0000 0000 0000 0000 109B 000F"            /* .ê...........õ.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"109C 000E 000A 4402 0090 000C 0000 0000"            /* .ú...¬D..ê...... */
	$"0000 0000 10A0 000F 000C 0400 0090 000C"            /* .....†.......ê.. */
	$"0000 0000 0000 0000 10A1 000E 000A 4402"            /* .........°...¬D. */
	$"0090 000C 0000 0000 0000 0000 10A5 000F"            /* .ê...........•.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"10A7 000E 000A 4402 0090 000C 0000 0000"            /* .ß...¬D..ê...... */
	$"0000 0000 10AD 000F 000C 0400 0090 000C"            /* .....≠.......ê.. */
	$"0000 0000 0000 0000 10AE 000E 000A 4402"            /* .........Æ...¬D. */
	$"0090 000C 0000 0000 0000 0000 10B2 000F"            /* .ê...........≤.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"10B3 000E 000A 4402 0090 000C 0000 0000"            /* .≥...¬D..ê...... */
	$"0000 0000 10B7 000F 000C 0400 0090 000C"            /* .....∑.......ê.. */
	$"0000 0000 0000 0000 10CE 000E 000A 4402"            /* .........Œ...¬D. */
	$"0090 000C 0000 0000 0000 0000 10D0 000F"            /* .ê...........–.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"10D2 000E 000A 4402 0090 000C 0000 0000"            /* .“...¬D..ê...... */
	$"0000 0000 10D4 000F 000C 0400 0090 000C"            /* .....‘.......ê.. */
	$"0000 0000 0000 0000 10D6 000E 000A 4402"            /* .........÷...¬D. */
	$"0090 000C 0000 0000 0000 0000 10D8 000F"            /* .ê...........ÿ.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"10F0 000E 000A 4402 0090 000C 0000 0000"            /* ....¬D..ê...... */
	$"0000 0000 10F2 000F 000C 0400 0090 000C"            /* .....Ú.......ê.. */
	$"0000 0000 0000 0000 10F4 000E 000A 4402"            /* .........Ù...¬D. */
	$"0090 000C 0000 0000 0000 0000 10F6 000F"            /* .ê...........ˆ.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"10F7 000E 000A 4402 0090 000C 0000 0000"            /* .˜...¬D..ê...... */
	$"0000 0000 10F9 000F 000C 0400 0090 000C"            /* .....˘.......ê.. */
	$"0000 0000 0000 0000 10FA 000E 000A 4402"            /* .........˙...¬D. */
	$"0090 000C 0000 0000 0000 0000 1100 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1101 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 1109 000F 000C 0400 0090 000C"            /* .....∆.......ê.. */
	$"0000 0000 0000 0000 110B 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 1111 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1112 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 1118 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 1119 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 1123 000F"            /* .ê...........#.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1125 000E 000A 4402 0090 000C 0000 0000"            /* .%...¬D..ê...... */
	$"0000 0000 1127 000F 000C 0400 0090 000C"            /* .....'.......ê.. */
	$"0000 0000 0000 0000 1129 000E 000A 4402"            /* .........)...¬D. */
	$"0090 000C 0000 0000 0000 0000 112F 000F"            /* .ê.........../.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1130 000E 000A 4402 0090 000C 0000 0000"            /* .0...¬D..ê...... */
	$"0000 0000 1136 000F 000C 0400 0090 000C"            /* .....6.......ê.. */
	$"0000 0000 0000 0000 1137 000E 000A 4402"            /* .........7...¬D. */
	$"0090 000C 0000 0000 0000 0000 1141 000F"            /* .ê...........A.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1142 000E 000A 4402 0090 000C 0000 0000"            /* .B...¬D..ê...... */
	$"0000 0000 1146 000F 000C 0400 0090 000C"            /* .....F.......ê.. */
	$"0000 0000 0000 0000 1147 000E 000A 4402"            /* .........G...¬D. */
	$"0090 000C 0000 0000 0000 0000 1149 000F"            /* .ê...........I.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"114A 000E 000A 4402 0090 000C 0000 0000"            /* .J...¬D..ê...... */
	$"0000 0000 1152 000F 000C 0400 0090 000C"            /* .....R.......ê.. */
	$"0000 0000 0000 0000 1153 000E 000A 4402"            /* .........S...¬D. */
	$"0090 000C 0000 0000 0000 0000 115B 000F"            /* .ê...........[.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"118A 000E 000A 4402 0090 000C 0000 0000"            /* .ä...¬D..ê...... */
	$"0000 0000 118C 000F 000C 0400 0090 000C"            /* .....å.......ê.. */
	$"0000 0000 0000 0000 118E 000E 000A 4402"            /* .........é...¬D. */
	$"0090 000C 0000 0000 0000 0000 1190 000F"            /* .ê...........ê.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1192 000E 000A 4402 0090 000C 0000 0000"            /* .í...¬D..ê...... */
	$"0000 0000 1194 000F 000C 0400 0090 000C"            /* .....î.......ê.. */
	$"0000 0000 0000 0000 11A7 000E 000A 4402"            /* .........ß...¬D. */
	$"0090 000C 0000 0000 0000 0000 11A9 000F"            /* .ê...........©.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"11AA 000E 000A 4402 0090 000C 0000 0000"            /* .™...¬D..ê...... */
	$"0000 0000 11AE 000F 000C 0400 0090 000C"            /* .....Æ.......ê.. */
	$"0000 0000 0000 0000 11B0 000E 000A 4402"            /* .........∞...¬D. */
	$"0090 000C 0000 0000 0000 0000 11B4 000F"            /* .ê...........¥.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"11B5 000E 000A 4402 0090 000C 0000 0000"            /* .µ...¬D..ê...... */
	$"0000 0000 11BD 000F 000C 0400 0090 000C"            /* .....Ω.......ê.. */
	$"0000 0000 0000 0000 11BE 000E 000A 4402"            /* .........æ...¬D. */
	$"0090 000C 0000 0000 0000 0000 11C2 000F"            /* .ê...........¬.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"11C3 000E 000A 4402 0090 000C 0000 0000"            /* .√...¬D..ê...... */
	$"0000 0000 11D1 000F 000C 0400 0090 000C"            /* .....—.......ê.. */
	$"0000 0000 0000 0000 11D2 000E 000A 4402"            /* .........“...¬D. */
	$"0090 000C 0000 0000 0000 0000 11D4 000F"            /* .ê...........‘.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"11D5 000E 000A 4402 0090 000C 0000 0000"            /* .’...¬D..ê...... */
	$"0000 0000 11DB 000F 000C 0400 0090 000C"            /* .....€.......ê.. */
	$"0000 0000 0000 0000 11DC 000E 000A 4402"            /* .........‹...¬D. */
	$"0090 000C 0000 0000 0000 0000 11E2 000F"            /* .ê...........‚.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"11E3 000E 000A 4402 0090 000C 0000 0000"            /* .„...¬D..ê...... */
	$"0000 0000 11EB 000F 000C 0400 0090 000C"            /* .....Î.......ê.. */
	$"0000 0000 0000 0000 11EC 000E 000A 4402"            /* .........Ï...¬D. */
	$"0090 000C 0000 0000 0000 0000 11F0 000F"            /* .ê............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"11F1 000E 000A 4402 0090 000C 0000 0000"            /* .Ò...¬D..ê...... */
	$"0000 0000 11F7 000F 000C 0400 0090 000C"            /* .....˜.......ê.. */
	$"0000 0000 0000 0000 11F8 000E 000A 4402"            /* .........¯...¬D. */
	$"0090 000C 0000 0000 0000 0000 1202 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1208 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 1210 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 1216 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 1218 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1219 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 121F 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 1220 000E 000A 4402"            /* ......... ...¬D. */
	$"0090 000C 0000 0000 0000 0000 1222 000F"            /* .ê...........".. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1223 000E 000A 4402 0090 000C 0000 0000"            /* .#...¬D..ê...... */
	$"0000 0000 1229 000F 000C 0400 0090 000C"            /* .....).......ê.. */
	$"0000 0000 0000 0000 122A 000E 000A 4402"            /* .........*...¬D. */
	$"0090 000C 0000 0000 0000 0000 1230 000F"            /* .ê...........0.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1231 000E 000A 4402 0090 000C 0000 0000"            /* .1...¬D..ê...... */
	$"0000 0000 1239 000F 000C 0400 0090 000C"            /* .....9.......ê.. */
	$"0000 0000 0000 0000 1242 000E 000A 4402"            /* .........B...¬D. */
	$"0090 000C 0000 0000 0000 0000 1244 000F"            /* .ê...........D.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1245 000E 000A 4402 0090 000C 0000 0000"            /* .E...¬D..ê...... */
	$"0000 0000 1249 000F 000C 0400 0090 000C"            /* .....I.......ê.. */
	$"0000 0000 0000 0000 124A 000E 000A 4402"            /* .........J...¬D. */
	$"0090 000C 0000 0000 0000 0000 1250 000F"            /* .ê...........P.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1251 000E 000A 4402 0090 000C 0000 0000"            /* .Q...¬D..ê...... */
	$"0000 0000 1257 000F 000C 0400 0090 000C"            /* .....W.......ê.. */
	$"0000 0000 0000 0000 1258 000E 000A 4402"            /* .........X...¬D. */
	$"0090 000C 0000 0000 0000 0000 125E 000F"            /* .ê...........^.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"125F 000E 000A 4402 0090 000C 0000 0000"            /* ._...¬D..ê...... */
	$"0000 0000 1265 000F 000C 0400 0090 000C"            /* .....e.......ê.. */
	$"0000 0000 0000 0000 1266 000E 000A 4402"            /* .........f...¬D. */
	$"0090 000C 0000 0000 0000 0000 126E 000F"            /* .ê...........n.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"126F 000E 000A 4402 0090 000C 0000 0000"            /* .o...¬D..ê...... */
	$"0000 0000 1275 000F 000C 0400 0090 000C"            /* .....u.......ê.. */
	$"0000 0000 0000 0000 127E 000E 000A 4402"            /* .........~...¬D. */
	$"0090 000C 0000 0000 0000 0000 1280 000F"            /* .ê...........Ä.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1281 000E 000A 4402 0090 000C 0000 0000"            /* .Å...¬D..ê...... */
	$"0000 0000 1285 000F 000C 0400 0090 000C"            /* .....Ö.......ê.. */
	$"0000 0000 0000 0000 1286 000E 000A 4402"            /* .........Ü...¬D. */
	$"0090 000C 0000 0000 0000 0000 128C 000F"            /* .ê...........å.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"128D 000E 000A 4402 0090 000C 0000 0000"            /* .ç...¬D..ê...... */
	$"0000 0000 1293 000F 000C 0400 0090 000C"            /* .....ì.......ê.. */
	$"0000 0000 0000 0000 1294 000E 000A 4402"            /* .........î...¬D. */
	$"0090 000C 0000 0000 0000 0000 1298 000F"            /* .ê...........ò.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1299 000E 000A 4402 0090 000C 0000 0000"            /* .ô...¬D..ê...... */
	$"0000 0000 12A1 000F 000C 0400 0090 000C"            /* .....°.......ê.. */
	$"0000 0000 0000 0000 12A2 000E 000A 4402"            /* .........¢...¬D. */
	$"0090 000C 0000 0000 0000 0000 12AA 000F"            /* .ê...........™.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"12AB 000E 000A 4402 0090 000C 0000 0000"            /* .´...¬D..ê...... */
	$"0000 0000 12B1 000F 000C 0400 0090 000C"            /* .....±.......ê.. */
	$"0000 0000 0000 0000 12B2 000E 000A 4402"            /* .........≤...¬D. */
	$"0090 000C 0000 0000 0000 0000 12B4 000F"            /* .ê...........¥.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"12B5 000E 000A 4402 0090 000C 0000 0000"            /* .µ...¬D..ê...... */
	$"0000 0000 12BD 000F 000C 0400 0090 000C"            /* .....Ω.......ê.. */
	$"0000 0000 0000 0000 12C3 000E 000A 4402"            /* .........√...¬D. */
	$"0090 000C 0000 0000 0000 0000 12CD 000F"            /* .ê...........Õ.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"12CE 000E 000A 4402 0090 000C 0000 0000"            /* .Œ...¬D..ê...... */
	$"0000 0000 12D2 000F 000C 0400 0090 000C"            /* .....“.......ê.. */
	$"0000 0000 0000 0000 12D3 000E 000A 4402"            /* .........”...¬D. */
	$"0090 000C 0000 0000 0000 0000 12DB 000F"            /* .ê...........€.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"12DC 000E 000A 4402 0090 000C 0000 0000"            /* .‹...¬D..ê...... */
	$"0000 0000 12E2 000F 000C 0400 0090 000C"            /* .....‚.......ê.. */
	$"0000 0000 0000 0000 12E3 000E 000A 4402"            /* .........„...¬D. */
	$"0090 000C 0000 0000 0000 0000 12EB 000F"            /* .ê...........Î.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"12ED 000E 000A 4402 0090 000C 0000 0000"            /* .Ì...¬D..ê...... */
	$"0000 0000 12EF 000F 000C 0400 0090 000C"            /* .....Ô.......ê.. */
	$"0000 0000 0000 0000 12F0 000E 000A 4402"            /* ............¬D. */
	$"0090 000C 0000 0000 0000 0000 12F6 000F"            /* .ê...........ˆ.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"12F7 000E 000A 4402 0090 000C 0000 0000"            /* .˜...¬D..ê...... */
	$"0000 0000 1301 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 1302 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 130A 000F"            /* .ê...........¬.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"130B 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 1311 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 1312 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 131A 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"131B 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 131F 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 1320 000E 000A 4402"            /* ......... ...¬D. */
	$"0090 000C 0000 0000 0000 0000 1328 000F"            /* .ê...........(.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1329 000E 000A 4402 0090 000C 0000 0000"            /* .)...¬D..ê...... */
	$"0000 0000 1333 000F 000C 0400 0090 000C"            /* .....3.......ê.. */
	$"0000 0000 0000 0000 1334 000E 000A 4402"            /* .........4...¬D. */
	$"0090 000C 0000 0000 0000 0000 1338 000F"            /* .ê...........8.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1339 000E 000A 4402 0090 000C 0000 0000"            /* .9...¬D..ê...... */
	$"0000 0000 133F 000F 000C 0400 0090 000C"            /* .....?.......ê.. */
	$"0000 0000 0000 0000 1340 000E 000A 4402"            /* .........@...¬D. */
	$"0090 000C 0000 0000 0000 0000 1344 000F"            /* .ê...........D.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1345 000E 000A 4402 0090 000C 0000 0000"            /* .E...¬D..ê...... */
	$"0000 0000 134F 000F 000C 0400 0090 000C"            /* .....O.......ê.. */
	$"0000 0000 0000 0000 1355 000E 000A 4402"            /* .........U...¬D. */
	$"0090 000C 0000 0000 0000 0000 1357 000F"            /* .ê...........W.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1358 000E 000A 4402 0090 000C 0000 0000"            /* .X...¬D..ê...... */
	$"0000 0000 135E 000F 000C 0400 0090 000C"            /* .....^.......ê.. */
	$"0000 0000 0000 0000 135F 000E 000A 4402"            /* ........._...¬D. */
	$"0090 000C 0000 0000 0000 0000 1371 000F"            /* .ê...........q.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1372 000E 000A 4402 0090 000C 0000 0000"            /* .r...¬D..ê...... */
	$"0000 0000 1376 000F 000C 0400 0090 000C"            /* .....v.......ê.. */
	$"0000 0000 0000 0000 1377 000E 000A 4402"            /* .........w...¬D. */
	$"0090 000C 0000 0000 0000 0000 1385 000F"            /* .ê...........Ö.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1386 000E 000A 4402 0090 000C 0000 0000"            /* .Ü...¬D..ê...... */
	$"0000 0000 138A 000F 000C 0400 0090 000C"            /* .....ä.......ê.. */
	$"0000 0000 0000 0000 138B 000E 000A 4402"            /* .........ã...¬D. */
	$"0090 000C 0000 0000 0000 0000 1393 000F"            /* .ê...........ì.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1394 000E 000A 4402 0090 000C 0000 0000"            /* .î...¬D..ê...... */
	$"0000 0000 139C 000F 000C 0400 0090 000C"            /* .....ú.......ê.. */
	$"0000 0000 0000 0000 13A2 000E 000A 4402"            /* .........¢...¬D. */
	$"0090 000C 0000 0000 0000 0000 13A4 000F"            /* .ê...........§.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"13A5 000E 000A 4402 0090 000C 0000 0000"            /* .•...¬D..ê...... */
	$"0000 0000 13AB 000F 000C 0400 0090 000C"            /* .....´.......ê.. */
	$"0000 0000 0000 0000 13AC 000E 000A 4402"            /* .........¨...¬D. */
	$"0090 000C 0000 0000 0000 0000 13B0 000F"            /* .ê...........∞.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"13B1 000E 000A 4402 0090 000C 0000 0000"            /* .±...¬D..ê...... */
	$"0000 0000 13B7 000F 000C 0400 0090 000C"            /* .....∑.......ê.. */
	$"0000 0000 0000 0000 13B8 000E 000A 4402"            /* .........∏...¬D. */
	$"0090 000C 0000 0000 0000 0000 13BC 000F"            /* .ê...........º.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"13BD 000E 000A 4402 0090 000C 0000 0000"            /* .Ω...¬D..ê...... */
	$"0000 0000 13C1 000F 000C 0400 0090 000C"            /* .....¡.......ê.. */
	$"0000 0000 0000 0000 13C2 000E 000A 4402"            /* .........¬...¬D. */
	$"0090 000C 0000 0000 0000 0000 13C6 000F"            /* .ê...........∆.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"13C7 000E 000A 4402 0090 000C 0000 0000"            /* .«...¬D..ê...... */
	$"0000 0000 13D1 000F 000C 0400 0090 000C"            /* .....—.......ê.. */
	$"0000 0000 0000 0000 13D2 000E 000A 4402"            /* .........“...¬D. */
	$"0090 000C 0000 0000 0000 0000 13DA 000F"            /* .ê...........⁄.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"13DB 000E 000A 4402 0090 000C 0000 0000"            /* .€...¬D..ê...... */
	$"0000 0000 13DF 000F 000C 0400 0090 000C"            /* .....ﬂ.......ê.. */
	$"0000 0000 0000 0000 13E1 000E 000A 4402"            /* .........·...¬D. */
	$"0090 000C 0000 0000 0000 0000 13E5 000F"            /* .ê...........Â.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"13E6 000E 000A 4402 0090 000C 0000 0000"            /* .Ê...¬D..ê...... */
	$"0000 0000 13EC 000F 000C 0400 0090 000C"            /* .....Ï.......ê.. */
	$"0000 0000 0000 0000 13ED 000E 000A 4402"            /* .........Ì...¬D. */
	$"0090 000C 0000 0000 0000 0000 13F7 000F"            /* .ê...........˜.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"13F8 000E 000A 4402 0090 000C 0000 0000"            /* .¯...¬D..ê...... */
	$"0000 0000 13FC 000F 000C 0400 0090 000C"            /* .....¸.......ê.. */
	$"0000 0000 0000 0000 13FD 000E 000A 4402"            /* .........˝...¬D. */
	$"0090 000C 0000 0000 0000 0000 1403 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1404 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 140A 000F 000C 0400 0090 000C"            /* .....¬.......ê.. */
	$"0000 0000 0000 0000 140B 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 140D 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"140E 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 1412 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 1413 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 141B 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"141C 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 1424 000F 000C 0400 0090 000C"            /* .....$.......ê.. */
	$"0000 0000 0000 0000 1426 000E 000A 4402"            /* .........&...¬D. */
	$"0090 000C 0000 0000 0000 0000 142C 000F"            /* .ê...........,.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"142D 000E 000A 4402 0090 000C 0000 0000"            /* .-...¬D..ê...... */
	$"0000 0000 1435 000F 000C 0400 0090 000C"            /* .....5.......ê.. */
	$"0000 0000 0000 0000 1436 000E 000A 4402"            /* .........6...¬D. */
	$"0090 000C 0000 0000 0000 0000 143C 000F"            /* .ê...........<.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"143D 000E 000A 4402 0090 000C 0000 0000"            /* .=...¬D..ê...... */
	$"0000 0000 1443 000F 000C 0400 0090 000C"            /* .....C.......ê.. */
	$"0000 0000 0000 0000 1444 000E 000A 4402"            /* .........D...¬D. */
	$"0090 000C 0000 0000 0000 0000 144E 000F"            /* .ê...........N.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1454 000E 000A 4402 0090 000C 0000 0000"            /* .T...¬D..ê...... */
	$"0000 0000 1458 000F 000C 0400 0090 000C"            /* .....X.......ê.. */
	$"0000 0000 0000 0000 1459 000E 000A 4402"            /* .........Y...¬D. */
	$"0090 000C 0000 0000 0000 0000 145D 000F"            /* .ê...........].. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"145E 000E 000A 4402 0090 000C 0000 0000"            /* .^...¬D..ê...... */
	$"0000 0000 1466 000F 000C 0400 0090 000C"            /* .....f.......ê.. */
	$"0000 0000 0000 0000 1468 000E 000A 4402"            /* .........h...¬D. */
	$"0090 000C 0000 0000 0000 0000 146A 000F"            /* .ê...........j.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"146B 000E 000A 4402 0090 000C 0000 0000"            /* .k...¬D..ê...... */
	$"0000 0000 146D 000F 000C 0400 0090 000C"            /* .....m.......ê.. */
	$"0000 0000 0000 0000 146E 000E 000A 4402"            /* .........n...¬D. */
	$"0090 000C 0000 0000 0000 0000 1474 000F"            /* .ê...........t.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1475 000E 000A 4402 0090 000C 0000 0000"            /* .u...¬D..ê...... */
	$"0000 0000 1479 000F 000C 0400 0090 000C"            /* .....y.......ê.. */
	$"0000 0000 0000 0000 147A 000E 000A 4402"            /* .........z...¬D. */
	$"0090 000C 0000 0000 0000 0000 1480 000F"            /* .ê...........Ä.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1481 000E 000A 4402 0090 000C 0000 0000"            /* .Å...¬D..ê...... */
	$"0000 0000 148B 000F 000C 0400 0090 000C"            /* .....ã.......ê.. */
	$"0000 0000 0000 0000 148D 000E 000A 4402"            /* .........ç...¬D. */
	$"0090 000C 0000 0000 0000 0000 148F 000F"            /* .ê...........è.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1490 000E 000A 4402 0090 000C 0000 0000"            /* .ê...¬D..ê...... */
	$"0000 0000 1496 000F 000C 0400 0090 000C"            /* .....ñ.......ê.. */
	$"0000 0000 0000 0000 1497 000E 000A 4402"            /* .........ó...¬D. */
	$"0090 000C 0000 0000 0000 0000 149D 000F"            /* .ê...........ù.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"149E 000E 000A 4402 0090 000C 0000 0000"            /* .û...¬D..ê...... */
	$"0000 0000 14A4 000F 000C 0400 0090 000C"            /* .....§.......ê.. */
	$"0000 0000 0000 0000 14A5 000E 000A 4402"            /* .........•...¬D. */
	$"0090 000C 0000 0000 0000 0000 14A7 000F"            /* .ê...........ß.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"14A8 000E 000A 4402 0090 000C 0000 0000"            /* .®...¬D..ê...... */
	$"0000 0000 14AC 000F 000C 0400 0090 000C"            /* .....¨.......ê.. */
	$"0000 0000 0000 0000 14AD 000E 000A 4402"            /* .........≠...¬D. */
	$"0090 000C 0000 0000 0000 0000 14B3 000F"            /* .ê...........≥.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"14B4 000E 000A 4402 0090 000C 0000 0000"            /* .¥...¬D..ê...... */
	$"0000 0000 14BC 000F 000C 0400 0090 000C"            /* .....º.......ê.. */
	$"0000 0000 0000 0000 14BD 000E 000A 4402"            /* .........Ω...¬D. */
	$"0090 000C 0000 0000 0000 0000 14C1 000F"            /* .ê...........¡.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"14C3 000E 000A 4402 0090 000C 0000 0000"            /* .√...¬D..ê...... */
	$"0000 0000 14C7 000F 000C 0400 0090 000C"            /* .....«.......ê.. */
	$"0000 0000 0000 0000 14C8 000E 000A 4402"            /* .........»...¬D. */
	$"0090 000C 0000 0000 0000 0000 14D0 000F"            /* .ê...........–.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"14D1 000E 000A 4402 0090 000C 0000 0000"            /* .—...¬D..ê...... */
	$"0000 0000 14D3 000F 000C 0400 0090 000C"            /* .....”.......ê.. */
	$"0000 0000 0000 0000 14D4 000E 000A 4402"            /* .........‘...¬D. */
	$"0090 000C 0000 0000 0000 0000 14DA 000F"            /* .ê...........⁄.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"14DB 000E 000A 4402 0090 000C 0000 0000"            /* .€...¬D..ê...... */
	$"0000 0000 14E7 000F 000C 0400 0090 000C"            /* .....Á.......ê.. */
	$"0000 0000 0000 0000 14E9 000E 000A 4402"            /* .........È...¬D. */
	$"0090 000C 0000 0000 0000 0000 14EB 000F"            /* .ê...........Î.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"14EC 000E 000A 4402 0090 000C 0000 0000"            /* .Ï...¬D..ê...... */
	$"0000 0000 14F2 000F 000C 0400 0090 000C"            /* .....Ú.......ê.. */
	$"0000 0000 0000 0000 14F3 000E 000A 4402"            /* .........Û...¬D. */
	$"0090 000C 0000 0000 0000 0000 14F7 000F"            /* .ê...........˜.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"14F8 000E 000A 4402 0090 000C 0000 0000"            /* .¯...¬D..ê...... */
	$"0000 0000 14FA 000F 000C 0400 0090 000C"            /* .....˙.......ê.. */
	$"0000 0000 0000 0000 14FB 000E 000A 4402"            /* .........˚...¬D. */
	$"0090 000C 0000 0000 0000 0000 1501 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1502 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 1504 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 1505 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 1509 000F"            /* .ê...........∆.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"150A 000E 000A 4402 0090 000C 0000 0000"            /* .¬...¬D..ê...... */
	$"0000 0000 1510 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 1511 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 1519 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"151A 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 1520 000F 000C 0400 0090 000C"            /* ..... .......ê.. */
	$"0000 0000 0000 0000 1521 000E 000A 4402"            /* .........!...¬D. */
	$"0090 000C 0000 0000 0000 0000 1529 000F"            /* .ê...........).. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"152A 000E 000A 4402 0090 000C 0000 0000"            /* .*...¬D..ê...... */
	$"0000 0000 1532 000F 000C 0400 0090 000C"            /* .....2.......ê.. */
	$"0000 0000 0000 0000 1538 000E 000A 4402"            /* .........8...¬D. */
	$"0090 000C 0000 0000 0000 0000 1540 000F"            /* .ê...........@.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1541 000E 000A 4402 0090 000C 0000 0000"            /* .A...¬D..ê...... */
	$"0000 0000 1549 000F 000C 0400 0090 000C"            /* .....I.......ê.. */
	$"0000 0000 0000 0000 154A 000E 000A 4402"            /* .........J...¬D. */
	$"0090 000C 0000 0000 0000 0000 1550 000F"            /* .ê...........P.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1551 000E 000A 4402 0090 000C 0000 0000"            /* .Q...¬D..ê...... */
	$"0000 0000 1559 000F 000C 0400 0090 000C"            /* .....Y.......ê.. */
	$"0000 0000 0000 0000 155B 000E 000A 4402"            /* .........[...¬D. */
	$"0090 000C 0000 0000 0000 0000 155D 000F"            /* .ê...........].. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"155E 000E 000A 4402 0090 000C 0000 0000"            /* .^...¬D..ê...... */
	$"0000 0000 1564 000F 000C 0400 0090 000C"            /* .....d.......ê.. */
	$"0000 0000 0000 0000 1565 000E 000A 4402"            /* .........e...¬D. */
	$"0090 000C 0000 0000 0000 0000 156B 000F"            /* .ê...........k.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"156C 000E 000A 4402 0090 000C 0000 0000"            /* .l...¬D..ê...... */
	$"0000 0000 1576 000F 000C 0400 0090 000C"            /* .....v.......ê.. */
	$"0000 0000 0000 0000 157C 000E 000A 4402"            /* .........|...¬D. */
	$"0090 000C 0000 0000 0000 0000 1582 000F"            /* .ê...........Ç.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1583 000E 000A 4402 0090 000C 0000 0000"            /* .É...¬D..ê...... */
	$"0000 0000 1585 000F 000C 0400 0090 000C"            /* .....Ö.......ê.. */
	$"0000 0000 0000 0000 1586 000E 000A 4402"            /* .........Ü...¬D. */
	$"0090 000C 0000 0000 0000 0000 158C 000F"            /* .ê...........å.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"158D 000E 000A 4402 0090 000C 0000 0000"            /* .ç...¬D..ê...... */
	$"0000 0000 1591 000F 000C 0400 0090 000C"            /* .....ë.......ê.. */
	$"0000 0000 0000 0000 1592 000E 000A 4402"            /* .........í...¬D. */
	$"0090 000C 0000 0000 0000 0000 1598 000F"            /* .ê...........ò.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1599 000E 000A 4402 0090 000C 0000 0000"            /* .ô...¬D..ê...... */
	$"0000 0000 159F 000F 000C 0400 0090 000C"            /* .....ü.......ê.. */
	$"0000 0000 0000 0000 15A0 000E 000A 4402"            /* .........†...¬D. */
	$"0090 000C 0000 0000 0000 0000 15A2 000F"            /* .ê...........¢.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"15A3 000E 000A 4402 0090 000C 0000 0000"            /* .£...¬D..ê...... */
	$"0000 0000 15A9 000F 000C 0400 0090 000C"            /* .....©.......ê.. */
	$"0000 0000 0000 0000 15AA 000E 000A 4402"            /* .........™...¬D. */
	$"0090 000C 0000 0000 0000 0000 15B0 000F"            /* .ê...........∞.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"15B1 000E 000A 4402 0090 000C 0000 0000"            /* .±...¬D..ê...... */
	$"0000 0000 15B9 000F 000C 0400 0090 000C"            /* .....π.......ê.. */
	$"0000 0000 0000 0000 15BA 000E 000A 4402"            /* .........∫...¬D. */
	$"0090 000C 0000 0000 0000 0000 15BC 000F"            /* .ê...........º.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"15BD 000E 000A 4402 0090 000C 0000 0000"            /* .Ω...¬D..ê...... */
	$"0000 0000 15C3 000F 000C 0400 0090 000C"            /* .....√.......ê.. */
	$"0000 0000 0000 0000 15C4 000E 000A 4402"            /* .........ƒ...¬D. */
	$"0090 000C 0000 0000 0000 0000 15C8 000F"            /* .ê...........».. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"15C9 000E 000A 4402 0090 000C 0000 0000"            /* .…...¬D..ê...... */
	$"0000 0000 15D3 000F 000C 0400 0090 000C"            /* .....”.......ê.. */
	$"0000 0000 0000 0000 15D4 000E 000A 4402"            /* .........‘...¬D. */
	$"0090 000C 0000 0000 0000 0000 15DC 000F"            /* .ê...........‹.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"15DD 000E 000A 4402 0090 000C 0000 0000"            /* .›...¬D..ê...... */
	$"0000 0000 15E1 000F 000C 0400 0090 000C"            /* .....·.......ê.. */
	$"0000 0000 0000 0000 15E2 000E 000A 4402"            /* .........‚...¬D. */
	$"0090 000C 0000 0000 0000 0000 15EE 000F"            /* .ê...........Ó.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"15EF 000E 000A 4402 0090 000C 0000 0000"            /* .Ô...¬D..ê...... */
	$"0000 0000 15F5 000F 000C 0400 0090 000C"            /* .....ı.......ê.. */
	$"0000 0000 0000 0000 15F6 000E 000A 4402"            /* .........ˆ...¬D. */
	$"0090 000C 0000 0000 0000 0000 15F8 000F"            /* .ê...........¯.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"15F9 000E 000A 4402 0090 000C 0000 0000"            /* .˘...¬D..ê...... */
	$"0000 0000 1601 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 1615 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 1617 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1618 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 161A 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 161B 000E 000A 4402"            /* .............¬D. */
	$"0090 000C 0000 0000 0000 0000 1621 000F"            /* .ê...........!.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1622 000E 000A 4402 0090 000C 0000 0000"            /* ."...¬D..ê...... */
	$"0000 0000 1626 000F 000C 0400 0090 000C"            /* .....&.......ê.. */
	$"0000 0000 0000 0000 1627 000E 000A 4402"            /* .........'...¬D. */
	$"0090 000C 0000 0000 0000 0000 162D 000F"            /* .ê...........-.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"162E 000E 000A 4402 0090 000C 0000 0000"            /* .....¬D..ê...... */
	$"0000 0000 1634 000F 000C 0400 0090 000C"            /* .....4.......ê.. */
	$"0000 0000 0000 0000 1635 000E 000A 4402"            /* .........5...¬D. */
	$"0090 000C 0000 0000 0000 0000 163B 000F"            /* .ê...........;.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"163C 000E 000A 4402 0090 000C 0000 0000"            /* .<...¬D..ê...... */
	$"0000 0000 1642 000F 000C 0400 0090 000C"            /* .....B.......ê.. */
	$"0000 0000 0000 0000 1643 000E 000A 4402"            /* .........C...¬D. */
	$"0090 000C 0000 0000 0000 0000 1645 000F"            /* .ê...........E.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1646 000E 000A 4402 0090 000C 0000 0000"            /* .F...¬D..ê...... */
	$"0000 0000 164E 000F 000C 0400 0090 000C"            /* .....N.......ê.. */
	$"0000 0000 0000 0000 1654 000E 000A 4402"            /* .........T...¬D. */
	$"0090 000C 0000 0000 0000 0000 1656 000F"            /* .ê...........V.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1657 000E 000A 4402 0090 000C 0000 0000"            /* .W...¬D..ê...... */
	$"0000 0000 165D 000F 000C 0400 0090 000C"            /* .....].......ê.. */
	$"0000 0000 0000 0000 165E 000E 000A 4402"            /* .........^...¬D. */
	$"0090 000C 0000 0000 0000 0000 1666 000F"            /* .ê...........f.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1668 000E 000A 4402 0090 000C 0000 0000"            /* .h...¬D..ê...... */
	$"0000 0000 166E 000F 000C 0400 0090 000C"            /* .....n.......ê.. */
	$"0000 0000 0000 0000 166F 000E 000A 4402"            /* .........o...¬D. */
	$"0090 000C 0000 0000 0000 0000 1675 000F"            /* .ê...........u.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1676 000E 000A 4402 0090 000C 0000 0000"            /* .v...¬D..ê...... */
	$"0000 0000 1678 000F 000C 0400 0090 000C"            /* .....x.......ê.. */
	$"0000 0000 0000 0000 1679 000E 000A 4402"            /* .........y...¬D. */
	$"0090 000C 0000 0000 0000 0000 167F 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1680 000E 000A 4402 0090 000C 0000 0000"            /* .Ä...¬D..ê...... */
	$"0000 0000 168A 000F 000C 0400 0090 000C"            /* .....ä.......ê.. */
	$"0000 0000 0000 0000 168B 000E 000A 4402"            /* .........ã...¬D. */
	$"0090 000C 0000 0000 0000 0000 168F 000F"            /* .ê...........è.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"1690 000E 000A 4402 0090 000C 0000 0000"            /* .ê...¬D..ê...... */
	$"0000 0000 1698 000F 000C 0400 0090 000C"            /* .....ò.......ê.. */
	$"0000 0000 0000 0000 1699 000E 000A 4402"            /* .........ô...¬D. */
	$"0090 000C 0000 0000 0000 0000 169F 000F"            /* .ê...........ü.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"16A1 000E 000A 4402 0090 000C 0000 0000"            /* .°...¬D..ê...... */
	$"0000 0000 16A9 000F 000C 0400 0090 000C"            /* .....©.......ê.. */
	$"0000 0000 0000 0000 16AA 000E 000A 4402"            /* .........™...¬D. */
	$"0090 000C 0000 0000 0000 0000 16B0 000F"            /* .ê...........∞.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"16B1 000E 000A 4402 0090 000C 0000 0000"            /* .±...¬D..ê...... */
	$"0000 0000 16B5 000F 000C 0400 0090 000C"            /* .....µ.......ê.. */
	$"0000 0000 0000 0000 16B6 000E 000A 4402"            /* .........∂...¬D. */
	$"0090 000C 0000 0000 0000 0000 16C0 000F"            /* .ê...........¿.. */
	$"000C 0400 0090 000C 0000 0000 0000"                 /* .....ê........ */
};

data 'TEXT' (5007, "Simplified Chinese SLA") {
	$"D5E2 CAC7 4341 4D49 4E4F D3C3 BBA7 D0ED"            /* ’‚ «CAMINO”√ªß–Ì */
	$"BFC9 D0AD D2E9 B5C4 B7C7 D5FD CABD D6D0"            /* ø…–≠“Èµƒ∑«’˝ Ω÷– */
	$"CEC4 D2EB B1BE A3AC CBF9 CBB5 C3F7 D3D0"            /* Œƒ“Î±æ£¨À˘Àµ√˜”– */
	$"B9D8 CAB9 D3C3 B1BE 4341 4D49 4E4F B8B4"            /* πÿ π”√±æCAMINO∏¥ */
	$"B1BE B5C4 CADA C8A8 CCF5 BFEE B2BB BEDF"            /* ±æµƒ ⁄»®ÃıøÓ≤ªæﬂ */
	$"B7A8 C2C9 D0A7 C1A6 A3AC D3A6 D6BB D2D4"            /* ∑®¬…–ß¡¶£¨”¶÷ª“‘ */
	$"CFC2 C3E6 B5C4 D3C3 BBA7 D0ED BFC9 D0AD"            /* œ¬√Êµƒ”√ªß–Ìø…–≠ */
	$"D2E9 D3A2 CEC4 D4AD CEC4 CEAA D7BC A1A3"            /* “È”¢Œƒ‘≠ŒƒŒ™◊º°£ */
	$"C8BB B6F8 A3AC CED2 C3C7 CFA3 CDFB B1BE"            /* »ª∂¯£¨Œ“√«œ£Õ˚±æ */
	$"D2EB B1BE BDAB D3D0 D6FA BDB2 D6D0 CEC4"            /* “Î±æΩ´”–÷˙Ω≤÷–Œƒ */
	$"B5C4 D3C3 BBA7 B8FC C1CB BDE2 4341 4D49"            /* µƒ”√ªß∏¸¡ÀΩ‚CAMI */
	$"4E4F B5C4 D3C3 BBA7 D0ED BFC9 D0AD D2E9"            /* NOµƒ”√ªß–Ìø…–≠“È */
	$"A1A3 0D0D 4341 4D49 4E4F 9770 BBA7 C8ED"            /* °£..CAMINOópªß»Ì */
	$"BCFE D0ED BFC9 D0AD D2E9 0DB5 DA31 2E31"            /* º˛–Ìø…–≠“È.µ⁄1.1 */
	$"B0E6 0D0D B8F9 BEDD 4D4F 5A49 4C4C 41B9"            /* ∞Ê..∏˘æ›MOZILLAπ */
	$"ABD3 C3D0 EDBF C9BA CDC6 E4CB FBBF AAB7"            /* ´”√–Ìø…∫Õ∆‰À˚ø™∑ */
	$"C5D4 ADCA BCC2 EBC8 EDBC FED0 EDBF C9A3"            /* ≈‘≠ º¬Î»Ìº˛–Ìø…£ */
	$"AC4D 4F5A 494C 4C41 D4DA 5757 572E 4D4F"            /* ¨MOZILLA‘⁄WWW.MO */
	$"5A49 4C4C 412E 4F52 47C3 E2B7 D1CC E1B9"            /* ZILLA.ORG√‚∑—Ã·π */
	$"A9C4 B3D0 A943 414D 494E 4FE4 AFC0 C0C6"            /* ©ƒ≥–©CAMINO‰Ø¿¿∆ */
	$"F7B9 A6C4 DCB5 C4D4 ADCA BCC2 EBB0 E6B1"            /* ˜π¶ƒ‹µƒ‘≠ º¬Î∞Ê± */
	$"BEA3 ACB9 A9C4 FACA B9D3 C3A1 A2D0 DEB8"            /* æ£¨π©ƒ˙ π”√°¢–ﬁ∏ */
	$"C4BA CDB7 D6B7 A2A1 A30D 0DCB E6B8 BDB5"            /* ƒ∫Õ∑÷∑¢°£..ÀÊ∏Ωµ */
	$"C443 414D 494E 4FD6 B4D0 D0C2 EBB0 E6B1"            /* ƒCAMINO÷¥––¬Î∞Ê± */
	$"BEBA CDCF E0B9 D8B5 C4CE C4BC FEA3 A8D2"            /* æ∫Õœ‡πÿµƒŒƒº˛£®“ */
	$"D4CF C2BC F2B3 C6D2 B2FA C6B7 D3A3 A9C4"            /* ‘œ¬ºÚ≥∆“≤˙∆∑”£©ƒ */
	$"CBB8 F9BE DDB1 BE43 414D 494E 4FD3 C3BB"            /* À∏˘æ›±æCAMINO”√ª */
	$"A7C8 EDBC FED0 EDBF C9D0 ADD2 E9A3 A8D2"            /* ß»Ìº˛–Ìø…–≠“È£®“ */
	$"D4CF C2BC F2B3 C6D2 D0ED BFC9 D0AD D2E9"            /* ‘œ¬ºÚ≥∆“–Ìø…–≠“È */
	$"D3A3 A9B5 C4CC F5BF EECE AAC4 FACC E1B9"            /* ”£©µƒÃıøÓŒ™ƒ˙Ã·π */
	$"A9A1 A3CD A8B9 FDB0 B4D2 BBCF C2D2 BDD3"            /* ©°£Õ®π˝∞¥“ªœ¬“Ω” */
	$"CADC D3B0 B4C5 A5A3 ACBB F2D5 DFB0 B2D7"            /*  ‹”∞¥≈•£¨ªÚ’ﬂ∞≤◊ */
	$"B0BB F2CA B9D3 C343 414D 494E 4FE4 AFC0"            /* ∞ªÚ π”√CAMINO‰Ø¿ */
	$"C0C6 F7A3 ACBC B4B1 EDCA BEC4 FACD ACD2"            /* ¿∆˜£¨º¥±Ì æƒ˙Õ¨“ */
	$"E2BD D3CA DCB1 BED0 EDBF C9D0 ADD2 E9CC"            /* ‚Ω” ‹±æ–Ìø…–≠“ÈÃ */
	$"F5BF EED6 AED4 BCCA F8A1 A3C8 E7B9 FBC4"            /* ıøÓ÷Æ‘º ¯°£»Áπ˚ƒ */
	$"FAB2 BBCD ACD2 E2BD D3CA DCB1 BED0 EDBF"            /* ˙≤ªÕ¨“‚Ω” ‹±æ–Ìø */
	$"C9D0 ADD2 E9B5 C4CC F5BF EEBA CDCC F5BC"            /* …–≠“ÈµƒÃıøÓ∫ÕÃıº */
	$"FEA3 ACC7 EBCE F0B0 B4D2 BDD3 CADC D3B0"            /* ˛£¨«ÎŒ∞¥“Ω” ‹”∞ */
	$"B4C5 A5A3 ACD2 B2B2 BBD2 AAB0 B2D7 B0BB"            /* ¥≈•£¨“≤≤ª“™∞≤◊∞ª */
	$"F2CA B9D3 C343 414D 494E 4FE4 AFC0 C0C6"            /* Ú π”√CAMINO‰Ø¿¿∆ */
	$"F7B5 C4C8 CEBA CEB2 BFB7 D6A1 A3D4 DAB0"            /* ˜µƒ»Œ∫Œ≤ø∑÷°£‘⁄∞ */
	$"B2D7 B043 414D 494E 4FB5 C4B9 FDB3 CCD6"            /* ≤◊∞CAMINOµƒπ˝≥Ã÷ */
	$"D0D2 D4BC B0C9 D4BA F3B5 C4CA B1BC E4A3"            /* –“‘º∞…‘∫Ûµƒ ±º‰£ */
	$"ACC4 FABF C9C4 DCBF C9D2 D4D1 A1D4 F1B0"            /* ¨ƒ˙ø…ƒ‹ø…“‘—°‘Ò∞ */
	$"B2D7 B0B5 DAC8 FDB7 BDCC E1B9 A9B5 C4C6"            /* ≤◊∞µ⁄»˝∑ΩÃ·π©µƒ∆ */
	$"E4CB FBD4 AABC FEA3 ACB0 B2D7 B0BA CDCA"            /* ‰À˚‘™º˛£¨∞≤◊∞∫Õ  */
	$"B9D3 C3B5 DAC8 FDB7 BDD4 AABC FEBF C9C4"            /* π”√µ⁄»˝∑Ω‘™º˛ø…ƒ */
	$"DCCA DCC6 E4CB FBD0 EDBF C9D0 ADD2 E9D4"            /* ‹ ‹∆‰À˚–Ìø…–≠“È‘ */
	$"BCCA F8A1 A30D 0D31 2E20 CAB9 D3C3 C8A8"            /* º ¯°£..1.  π”√»® */
	$"B5C4 CADA D3E8 204D 6F7A 696C 6C61 2046"            /* µƒ ⁄”Ë Mozilla F */
	$"6F75 6E64 6174 696F 6ECA DAD3 E8C4 FACA"            /* oundation ⁄”Ëƒ˙  */
	$"B9D3 C3B1 BEB2 FAC6 B7D6 B4D0 D0C2 EBB0"            /* π”√±æ≤˙∆∑÷¥––¬Î∞ */
	$"E6B1 BEB5 C4B7 C7D7 A8D3 C3C8 A8C0 FBA1"            /* Ê±æµƒ∑«◊®”√»®¿˚° */
	$"A3B1 BED0 EDBF C9D0 ADD2 E9D2 B2BD ABD4"            /* £±æ–Ìø…–≠“È“≤Ω´‘ */
	$"BCCA F84D 6F7A 696C 6C61 D3C3 C0B4 C8A1"            /* º ¯Mozilla”√¿¥»° */
	$"B4FA BACD A3AF BBF2 B2B9 B3E4 D4AD CABC"            /* ¥˙∫Õ£ØªÚ≤π≥‰‘≠ º */
	$"B2FA C6B7 B5C4 C8ED BCFE C9FD BCB6 A3AC"            /* ≤˙∆∑µƒ»Ìº˛…˝º∂£¨ */
	$"B3FD B7C7 B8C3 B5C8 C9FD BCB6 C1ED CDE2"            /* ≥˝∑«∏√µ»…˝º∂¡ÌÕ‚ */
	$"CBE6 B8BD D0ED BFC9 D0AD D2E9 A1A3 D4DA"            /* ÀÊ∏Ω–Ìø…–≠“È°£‘⁄ */
	$"C1ED D3D0 D0ED BFC9 D0AD D2E9 B5C4 C7E9"            /* ¡Ì”––Ìø…–≠“Èµƒ«È */
	$"BFF6 CFC2 A3AC BDAB CADC D3D0 B9D8 CADA"            /* øˆœ¬£¨Ω´ ‹”–πÿ ⁄ */
	$"C8A8 CCF5 BFEE B5C4 D4BC CAF8 A1A3 0D0D"            /* »®ÃıøÓµƒ‘º ¯°£.. */
	$"322E 20D6 D5D6 B920 C8F4 C4FA CEA5 B7B4"            /* 2. ÷’÷π »Ùƒ˙Œ•∑¥ */
	$"B1BE D0ED BFC9 D0AD D2E9 A3AC BDAB C1A2"            /* ±æ–Ìø…–≠“È£¨Ω´¡¢ */
	$"BCB4 D6D5 D6B9 C4FA CAB9 D3C3 B1BE B2FA"            /* º¥÷’÷πƒ˙ π”√±æ≤˙ */
	$"C6B7 B5C4 C8A8 C0FB A3AC CEE3 D0EB C1ED"            /* ∆∑µƒ»®¿˚£¨Œ„–Î¡Ì */
	$"D0D0 CDA8 D6AA A3AC CEA9 B1BE D0ED BFC9"            /* ––Õ®÷™£¨Œ©±æ–Ìø… */
	$"D0AD D2E9 B5C4 CBF9 D3D0 CCF5 CEC4 A3A8"            /* –≠“ÈµƒÀ˘”–ÃıŒƒ£® */
	$"B5DA 31B6 CED2 CAB9 D3C3 C8A8 D6AE CADA"            /* µ⁄1∂Œ“ π”√»®÷Æ ⁄ */
	$"D3E8 D3B3 FDCD E2A3 A9D4 DAD6 D5D6 B9CA"            /* ”Ë”≥˝Õ‚£©‘⁄÷’÷π  */
	$"B9D3 C3C8 A8BA F3BD ABC8 D4C8 BBD3 D0D0"            /* π”√»®∫ÛΩ´»‘»ª”–– */
	$"A7A1 A3BD ECCA B1A3 ACC4 FAB1 D8D0 EBCF"            /* ß°£ΩÏ ±£¨ƒ˙±ÿ–Îœ */
	$"FABB D9B1 BEB2 FAC6 B7D6 AECB F9D3 D0B8"            /* ˙ªŸ±æ≤˙∆∑÷ÆÀ˘”–∏ */
	$"B4B1 BEA1 A30D 0D33 2E20 D7A8 D3D0 C8A8"            /* ¥±æ°£..3. ◊®”–»® */
	$"20B1 BEB2 FAC6 B7B5 C4B2 BFB7 D6B9 A6C4"            /*  ±æ≤˙∆∑µƒ≤ø∑÷π¶ƒ */
	$"DCB8 F9BE DD4D 6F7A 696C 6C61 B9AB D3C3"            /* ‹∏˘æ›Mozillaπ´”√ */
	$"D0ED BFC9 BACD C6E4 CBFB BFAA B7C5 D4AD"            /* –Ìø…∫Õ∆‰À˚ø™∑≈‘≠ */
	$"CABC C2EB D0ED BFC9 A3A8 CDB3 B3C6 D2BF"            /*  º¬Î–Ìø…£®Õ≥≥∆“ø */
	$"AAB7 C5D4 ADCA BCC2 EBD0 EDBF C9D3 A3A9"            /* ™∑≈‘≠ º¬Î–Ìø…”£© */
	$"B5C4 CCF5 BFEE A3AC D2D4 D4AD CABC C2EB"            /* µƒÃıøÓ£¨“‘‘≠ º¬Î */
	$"B5C4 D0CE CABD D4DA 6874 7470 3A2F 2F77"            /* µƒ–Œ Ω‘⁄http://w */
	$"7777 2E6D 6F7A 696C 6C61 2E6F 7267 C9CF"            /* ww.mozilla.org…œ */
	$"CCE1 B9A9 A1A3 B1BE D0ED BFC9 D0AD D2E9"            /* Ã·π©°£±æ–Ìø…–≠“È */
	$"D6D0 B5C4 C8CE BACE CCF5 BFEE B2BB D3A6"            /* ÷–µƒ»Œ∫ŒÃıøÓ≤ª”¶ */
	$"DAB9 CACD CEAA CFDE D6C6 C8CE BACE B8F9"            /* ⁄π ÕŒ™œﬁ÷∆»Œ∫Œ∏˘ */
	$"BEDD BFAA B7C5 D4AD CABC C2EB CADA C8A8"            /* æ›ø™∑≈‘≠ º¬Î ⁄»® */
	$"CADA D3E8 B5C4 C8A8 C0FB A1A3 B3FD C9CF"            /*  ⁄”Ëµƒ»®¿˚°£≥˝…œ */
	$"CEC4 CBF9 CAF6 D6AE CDE2 A3AC 4D6F 7A69"            /* ŒƒÀ˘ ˆ÷ÆÕ‚£¨Mozi */
	$"6C6C 61BD F7B4 FAB1 EDB1 BEC9 EDBA CDC6"            /* llaΩ˜¥˙±Ì±æ…Ì∫Õ∆ */
	$"E4D0 EDBF C9C8 CBB1 A3C1 F4B1 BEB2 FAC6"            /* ‰–Ìø…»À±£¡Ù±æ≤˙∆ */
	$"B7D6 D0B5 C4CB F9D3 D0D6 AACA B6B2 FAC8"            /* ∑÷–µƒÀ˘”–÷™ ∂≤˙» */
	$"A8A3 ACCE A9B1 BED0 EDBF C9D0 ADD2 E9C3"            /* ®£¨Œ©±æ–Ìø…–≠“È√ */
	$"F7CE C4CA DAD3 E8B5 C4C8 A8C0 FBB3 FDCD"            /* ˜Œƒ ⁄”Ëµƒ»®¿˚≥˝Õ */
	$"E2A1 A3C4 FAB2 BBB5 C3D2 C6B3 FDBB F2B8"            /* ‚°£ƒ˙≤ªµ√“∆≥˝ªÚ∏ */
	$"FCB8 C4B2 FAC6 B7D6 D0BB F2C9 CFC3 E6B5"            /* ¸∏ƒ≤˙∆∑÷–ªÚ…œ√Êµ */
	$"C4C8 CEBA CEC9 CCB1 EAA1 A2B1 EAD6 BEA1"            /* ƒ»Œ∫Œ…Ã±Í°¢±Í÷æ° */
	$"A2D6 F8D7 F7C8 A8BB F2C6 E4CB FBD7 A8D3"            /* ¢÷¯◊˜»®ªÚ∆‰À˚◊®” */
	$"D0C8 A8CD A8D6 AAA1 A3B1 BED0 EDBF C9D0"            /* –»®Õ®÷™°£±æ–Ìø…– */
	$"ADD2 E9B2 A2CE B4CA DAC8 A8C4 FACA B9D3"            /* ≠“È≤¢Œ¥ ⁄»®ƒ˙ π” */
	$"C34D 6F7A 696C 6C61 BBF2 C6E4 D0ED BFC9"            /* √MozillaªÚ∆‰–Ìø… */
	$"C8CB B5C4 C9CC B1EA A1A2 B7FE CEF1 C9CC"            /* »Àµƒ…Ã±Í°¢∑˛ŒÒ…Ã */
	$"B1EA BBF2 B1EA D6BE A1A3 0D0D 342E 20B5"            /* ±ÍªÚ±Í÷æ°£..4. µ */
	$"A3B1 A3C3 E2D4 F0C9 F9C3 F720 B1BE B2FA"            /* £±£√‚‘…˘√˜ ±æ≤˙ */
	$"C6B7 C4CB C1AC CDAC CBF9 D3D0 B4ED CEF3"            /* ∆∑ƒÀ¡¨Õ¨À˘”–¥ÌŒÛ */
	$"D2D2 C0D1 F9D3 CCE1 B9A9 A1A3 D4DA B7A8"            /* ““¿—˘”Ã·π©°£‘⁄∑® */
	$"C2C9 D4CA D0ED B5C4 B7B6 CEA7 CFC2 A3AC"            /* ¬…‘ –Ìµƒ∑∂Œßœ¬£¨ */
	$"4D4F 5A49 4C4C 41BC B0C6 E4B7 D6CF FAC9"            /* MOZILLAº∞∆‰∑÷œ˙… */
	$"CCBA CDD0 EDBF C9C8 CBBD F7B4 CBC9 F9C3"            /* Ã∫Õ–Ìø…»ÀΩ˜¥À…˘√ */
	$"F7A3 ACB2 BBB8 BAC8 CEBA CED3 EBB1 BEB2"            /* ˜£¨≤ª∏∫»Œ∫Œ”Î±æ≤ */
	$"FAC6 B7D3 D0B9 D8D6 AEC3 F7CA BEBB F2C4"            /* ˙∆∑”–πÿ÷Æ√˜ æªÚƒ */
	$"ACCA BEB5 A3B1 A3D4 F0C8 CEA3 ACB0 FCC0"            /* ¨ æµ£±£‘»Œ£¨∞¸¿ */
	$"A8B5 ABB2 BBCF DED3 DAB2 FAC6 B7CE DEE8"            /* ®µ´≤ªœﬁ”⁄≤˙∆∑ŒﬁË */
	$"A6B4 C3A1 A2CA CABA CFC9 CCCF FAA1 A2CA"            /* ¶¥√°¢  ∫œ…Ãœ˙°¢  */
	$"CAD3 C3D3 DAC4 B3D2 BBCC D8B6 A8D3 C3CD"            /*  ”√”⁄ƒ≥“ªÃÿ∂®”√Õ */
	$"BEBB F2B2 BBC7 D6C8 A8B5 C4B5 A3B1 A3D4"            /* æªÚ≤ª«÷»®µƒµ£±£‘ */
	$"F0C8 CEA1 A3D6 C1D3 DAD1 A1D4 F1B1 BEB2"            /* »Œ°£÷¡”⁄—°‘Ò±æ≤ */
	$"FAC6 B7D7 F7C4 FAB5 C4D3 C3CD BEA3 ACD2"            /* ˙∆∑◊˜ƒ˙µƒ”√Õæ£¨“ */
	$"D4BC B0B1 BEB2 FAC6 B7B5 C4D6 CAC1 BFBA"            /* ‘º∞±æ≤˙∆∑µƒ÷ ¡ø∫ */
	$"CDD0 D4C4 DCA3 ACC4 FAD0 EBD7 D4D0 D0B3"            /* Õ–‘ƒ‹£¨ƒ˙–Î◊‘––≥ */
	$"D0B5 A3C8 ABB2 BFB7 E7CF D5A1 A3BE A1B9"            /* –µ£»´≤ø∑Áœ’°£æ°π */
	$"DCC8 CEBA CEBE C8BC C3B5 C4D6 F7D2 AAD3"            /* ‹»Œ∫Œæ»º√µƒ÷˜“™” */
	$"C3CD BECA A7D0 A7A3 ACB4 CBCF EECF DED6"            /* √Õæ ß–ß£¨¥ÀœÓœﬁ÷ */
	$"C6C8 D4C8 BBCA CAD3 C3A1 A3C4 B3D0 A9B9"            /* ∆»‘»ª  ”√°£ƒ≥–©π */
	$"DCCF BDC7 F8B2 A2B2 BBD4 CAD0 EDC5 C5B3"            /* ‹œΩ«¯≤¢≤ª‘ –Ì≈≈≥ */
	$"FDBB F2CF DED6 C6C4 ACCA BEB5 A3B1 A3D4"            /* ˝ªÚœﬁ÷∆ƒ¨ æµ£±£‘ */
	$"F0C8 CEA3 ACD2 F2B4 CBB4 CBCF EEC3 E2D4"            /* »Œ£¨“Ú¥À¥ÀœÓ√‚‘ */
	$"F0C9 F9C3 F7BF C9C4 DCB6 D4C4 FAB2 BBCA"            /* …˘√˜ø…ƒ‹∂‘ƒ˙≤ª  */
	$"CAD3 C3A1 A30D 0D35 2E20 D4F0 C8CE CFDE"            /*  ”√°£..5. ‘»Œœﬁ */
	$"D6C6 20B3 FDB7 C7B7 A8C2 C9C1 EDD3 D0B9"            /* ÷∆ ≥˝∑«∑®¬…¡Ì”–π */
	$"E6B6 A8A3 AC4D 4F5A 494C 4C41 D2D4 BCB0"            /* Ê∂®£¨MOZILLA“‘º∞ */
	$"C6E4 B7D6 CFFA C9CC A1A2 B6AD CAC2 A1A2"            /* ∆‰∑÷œ˙…Ã°¢∂≠ ¬°¢ */
	$"D0ED BFC9 C8CB A1A2 B9A9 D3A6 C9CC BACD"            /* –Ìø…»À°¢π©”¶…Ã∫Õ */
	$"B4FA C0ED A3A8 CDB3 B3C6 D24D 4F5A 494C"            /* ¥˙¿Ì£®Õ≥≥∆“MOZIL */
	$"4C41 BCAF CDC5 D3A3 A9B6 D4D2 F2B1 BED0"            /* LAºØÕ≈”£©∂‘“Ú±æ– */
	$"EDBF C9D0 ADD2 E9BB F2D5 DFCA B9D3 C3BB"            /* Ìø…–≠“ÈªÚ’ﬂ π”√ª */
	$"F2CE DEB7 A8CA B9D3 C3B1 BEB2 FAC6 B7BB"            /* ÚŒﬁ∑® π”√±æ≤˙∆∑ª */
	$"F2CF E0B9 D8D4 ADD2 F2CB F9B2 FAC9 FAD6"            /* Úœ‡πÿ‘≠“ÚÀ˘≤˙…˙÷ */
	$"AEC8 CEBA CEBC E4BD D3A1 A2CC D8B1 F0A1"            /* Æ»Œ∫Œº‰Ω”°¢Ãÿ±° */
	$"A2B8 BDCB E6A1 A2B1 D8C8 BBBB F2B3 CDB7"            /* ¢∏ΩÀÊ°¢±ÿ»ªªÚ≥Õ∑ */
	$"A3D0 D4CB F0BA A6A3 A8B0 FCC0 A8B5 ABB2"            /* £–‘À∫¶£®∞¸¿®µ´≤ */
	$"BBCF DED3 DAD2 F2C9 CCD3 FECB F0CA A7A1"            /* ªœﬁ”⁄“Ú…Ã”˛À ß° */
	$"A2D3 AAD2 B5D6 D0B6 CFA1 A2C0 FBC8 F3CB"            /* ¢”™“µ÷–∂œ°¢¿˚»ÛÀ */
	$"F0CA A7A1 A2CA FDBE DDC9 A5CA A7BC B0B5"            /*  ß°¢ ˝æ›…• ßº∞µ */
	$"E7C4 D4CA A7C1 E9BB F2B9 CAD5 CFCB F9B2"            /* Áƒ‘ ß¡ÈªÚπ ’œÀ˘≤ */
	$"FAC9 FAD6 AECB F0BA A6A3 A9B8 C5B2 BBB8"            /* ˙…˙÷ÆÀ∫¶£©∏≈≤ª∏ */
	$"BAD4 F0A3 ACBC B4CA B9CA C2CF C8BB F1B8"            /* ∫‘£¨º¥ π ¬œ»ªÒ∏ */
	$"E6D6 AAB8 C3B5 C8CB F0BA A6B7 A2C9 FAD6"            /* Ê÷™∏√µ»À∫¶∑¢…˙÷ */
	$"AEBF C9C4 DCD0 D4A3 ACC7 D2B2 BBC2 DBCB"            /* Æø…ƒ‹–‘£¨«“≤ª¬€À */
	$"F7B3 A5CB F9B8 F9BE DDB5 C4C0 EDBE DDA3"            /* ˜≥•À˘∏˘æ›µƒ¿Ìæ›£ */
	$"A8BA CFD4 BCA1 A2C7 D6C8 A8BB F2C6 E4CB"            /* ®∫œ‘º°¢«÷»®ªÚ∆‰À */
	$"FBC0 EDD3 C9A3 A9D2 E0CD ACA1 A34D 4F5A"            /* ˚¿Ì”…£©“‡Õ¨°£MOZ */
	$"494C 4C41 20BC AFCD C5D2 C0B1 BED0 EDBF"            /* ILLA ºØÕ≈“¿±æ–Ìø */
	$"C9D0 ADD2 E9CB F9B8 BAD6 AEC8 ABB2 BFD4"            /* …–≠“ÈÀ˘∏∫÷Æ»´≤ø‘ */
	$"F0C8 CEA3 ACBD ABB2 BBB3 ACB9 FD35 3030"            /* »Œ£¨Ω´≤ª≥¨π˝500 */
	$"C3C0 D4AA D3EB C4FA B8F9 BEDD B1BE D0ED"            /* √¿‘™”Îƒ˙∏˘æ›±æ–Ì */
	$"BFC9 D2D1 D6A7 B8B6 BFEE CFEE A3A8 C8E7"            /* ø…“—÷ß∏∂øÓœÓ£®»Á */
	$"D3D0 A3A9 C1BD D5DF D6D0 D6AE BDCF B4F3"            /* ”–£©¡Ω’ﬂ÷–÷ÆΩœ¥Û */
	$"D5DF A1A3 C4B3 D0A9 B9DC CFBD C7F8 B2A2"            /* ’ﬂ°£ƒ≥–©π‹œΩ«¯≤¢ */
	$"B2BB D4CA D0ED C5C5 B3FD BBF2 CFDE D6C6"            /* ≤ª‘ –Ì≈≈≥˝ªÚœﬁ÷∆ */
	$"B8BD CBE6 A1A2 B1D8 C8BB BBF2 CCD8 B1F0"            /* ∏ΩÀÊ°¢±ÿ»ªªÚÃÿ± */
	$"CBF0 BAA6 D4F0 C8CE A3AC D2F2 B4CB B4CB"            /* À∫¶‘»Œ£¨“Ú¥À¥À */
	$"CFEE D4F0 C8CE C5C5 B3FD BACD CFDE D6C6"            /* œÓ‘»Œ≈≈≥˝∫Õœﬁ÷∆ */
	$"BFC9 C4DC B6D4 C4FA B2BB CACA D3C3 A1A3"            /* ø…ƒ‹∂‘ƒ˙≤ª  ”√°£ */
	$"0D0D 362E 20B3 F6BF DAB9 DCD6 C620 B1BE"            /* ..6. ≥ˆø⁄π‹÷∆ ±æ */
	$"D0ED BFC9 CADC CBF9 D3D0 CACA D3C3 B5C4"            /* –Ìø… ‹À˘”–  ”√µƒ */
	$"B3F6 BFDA CFDE D6C6 D4BC CAF8 A1A3 C4FA"            /* ≥ˆø⁄œﬁ÷∆‘º ¯°£ƒ˙ */
	$"B1D8 D0EB D7F1 CAD8 C3C0 B9FA BBF2 CDE2"            /* ±ÿ–Î◊Ò ÿ√¿π˙ªÚÕ‚ */
	$"B9FA BBFA B9B9 BBF2 B9DC C0ED B5B1 BED6"            /* π˙ª˙ππªÚπ‹¿Ìµ±æ÷ */
	$"D3D0 B9D8 B1BE B2FA C6B7 BACD C6E4 CAB9"            /* ”–πÿ±æ≤˙∆∑∫Õ∆‰ π */
	$"D3C3 B5C4 CBF9 D3D0 BDF8 B3F6 BFDA B7A8"            /* ”√µƒÀ˘”–Ω¯≥ˆø⁄∑® */
	$"C2C9 A1A2 CFDE D6C6 BACD B9E6 D4F2 A1A3"            /* ¬…°¢œﬁ÷∆∫ÕπÊ‘Ú°£ */
	$"0D0D 372E 20C3 C0B9 FAD5 FEB8 AED3 C3BB"            /* ..7. √¿π˙’˛∏Æ”√ª */
	$"A720 D2C0 3438 2043 2E46 2E52 2E20 322E"            /* ß “¿48 C.F.R. 2. */
	$"3130 31D6 D0B5 C4B6 A8D2 E5A3 ACB1 BEB2"            /* 101÷–µƒ∂®“Â£¨±æ≤ */
	$"FAC6 B7CA C720 D2C9 CCD3 C3C6 B7D3 A3AC"            /* ˙∆∑ « “…Ã”√∆∑”£¨ */
	$"B0FC BAAC 3438 2043 2E46 2E52 2E20 3132"            /* ∞¸∫¨48 C.F.R. 12 */
	$"2E32 3132 A3A8 3139 3935 C4EA 39D4 C2A3"            /* .212£®1995ƒÍ9‘¬£ */
	$"A9BA CD34 3820 432E 462E 522E 2032 3237"            /* ©∫Õ48 C.F.R. 227 */
	$"2E37 3230 32A3 A831 3939 35C4 EA36 D4C2"            /* .7202£®1995ƒÍ6‘¬ */
	$"A3A9 CBF9 B3C6 B5C4 D2C9 CCD3 C3B5 E7C4"            /* £©À˘≥∆µƒ“…Ã”√µÁƒ */
	$"D4C8 EDBC FED3 D2D4 BCB0 D2C9 CCD3 C3B5"            /* ‘»Ìº˛”“‘º∞“…Ã”√µ */
	$"E7C4 D4C8 EDBC FECE C4BC FED3 A1A3 CEAA"            /* Áƒ‘»Ìº˛Œƒº˛”°£Œ™ */
	$"C8B7 B1A3 D3EB 3438 2043 2E46 2E52 2E20"            /* »∑±£”Î48 C.F.R.  */
	$"3132 2E32 3132 A1A2 3438 2043 2E46 2E52"            /* 12.212°¢48 C.F.R */
	$"2E20 3237 2E34 3035 2862 2928 3229 20A3"            /* . 27.405(b)(2) £ */
	$"A831 3939 38C4 EA36 D4C2 A3A9 BACD 3438"            /* ®1998ƒÍ6‘¬£©∫Õ48 */
	$"2043 2E46 2E52 2E20 3232 372E 3732 3032"            /*  C.F.R. 227.7202 */
	$"B5C4 D2BB D6C2 D0D4 A3AC CBF9 D3D0 C3C0"            /* µƒ“ª÷¬–‘£¨À˘”–√¿ */
	$"B9FA D5FE B8AE D3C3 BBA7 BBF1 B5C3 B1BE"            /* π˙’˛∏Æ”√ªßªÒµ√±æ */
	$"B2FA C6B7 CAB1 A3AC D6BB D3B5 D3D0 B1BE"            /* ≤˙∆∑ ±£¨÷ª”µ”–±æ */
	$"CEC4 CBF9 CAF6 B5C4 C8A8 C0FB A1A3 0D0D"            /* ŒƒÀ˘ ˆµƒ»®¿˚°£.. */
	$"382E 20C6 E4CB FB20 2861 2920 B1BE D0ED"            /* 8. ∆‰À˚ (a) ±æ–Ì */
	$"BFC9 D0AD D2E9 B9B9 B3C9 C4FA BACD 4D6F"            /* ø…–≠“Èππ≥…ƒ˙∫ÕMo */
	$"7A69 6C6C 61D6 AEBC E4BE CDB1 EAB5 C4CA"            /* zilla÷Æº‰æÕ±Íµƒ  */
	$"C2CF EEB6 A9C1 A2B5 C4CD EAD5 FBD0 ADD2"            /* ¬œÓ∂©¡¢µƒÕÍ’˚–≠“ */
	$"E9A3 ACD6 BBBF C9CD A8B9 FD4D 6F7A 696C"            /* È£¨÷ªø…Õ®π˝Mozil */
	$"6C61 20CA DAC8 A8B5 C4D0 D0D5 FEC8 CBD4"            /* la  ⁄»®µƒ––’˛»À‘ */
	$"B1C7 A9B7 A2B5 C4CA E9C3 E6D0 DEB6 A9CA"            /* ±«©∑¢µƒ È√Ê–ﬁ∂©  */
	$"E9D0 DEB8 C4A1 A328 6229 20B3 FDB7 C7CA"            /* È–ﬁ∏ƒ°£(b) ≥˝∑«  */
	$"CAD3 C3B7 A8C2 C9A3 A8C8 E7D3 D0A3 A9C1"            /*  ”√∑®¬…£®»Á”–£©¡ */
	$"EDD3 D0B9 E6B6 A8A3 ACB1 BED0 EDBF C9D0"            /* Ì”–πÊ∂®£¨±æ–Ìø…– */
	$"ADD2 E9BD ABCA DCC3 C0B9 FABC D3D6 DDB7"            /* ≠“ÈΩ´ ‹√¿π˙º”÷›∑ */
	$"A8C2 C9B9 DCCF BDA3 ACCE A9C6 E4B7 A8C2"            /* ®¬…π‹œΩ£¨Œ©∆‰∑®¬ */
	$"C9B3 E5CD BBCC F5CE C4B3 FDCD E2A1 A328"            /* …≥ÂÕªÃıŒƒ≥˝Õ‚°£( */
	$"6329 20B1 BED0 EDBF C9D0 ADD2 E9B2 BBCA"            /* c) ±æ–Ìø…–≠“È≤ª  */
	$"DCC1 AABA CFB9 FAB9 FABC CABB F5CE EFCF"            /* ‹¡™∫œπ˙π˙º ªıŒÔœ */
	$"FACA DBBA CFCD ACB9 ABD4 BCA3 A855 6E69"            /* ˙ €∫œÕ¨π´‘º£®Uni */
	$"7465 6420 4E61 7469 6F6E 7320 436F 6E76"            /* ted Nations Conv */
	$"656E 7469 6F6E 206F 6E20 436F 6E74 7261"            /* ention on Contra */
	$"6374 7320 666F 7220 7468 6520 496E 7465"            /* cts for the Inte */
	$"726E 6174 696F 6E61 6C20 5361 6C65 206F"            /* rnational Sale o */
	$"6620 476F 6F64 73A3 A9D4 BCCA F8A1 A328"            /* f Goods£©‘º ¯°£( */
	$"6429 20C8 F4B1 BED0 EDBF C9D0 ADD2 E9D6"            /* d) »Ù±æ–Ìø…–≠“È÷ */
	$"D0D3 D0C8 CEBA CECC F5BF EEBE ADB2 C3B6"            /* –”–»Œ∫ŒÃıøÓæ≠≤√∂ */
	$"A8CE AAB2 BBBE DFD0 A7C1 A6BB F2CE DEB7"            /* ®Œ™≤ªæﬂ–ß¡¶ªÚŒﬁ∑ */
	$"A8D6 B4D0 D0CA B1A3 ACBD ABDA B9CA CDB8"            /* ®÷¥–– ±£¨Ω´⁄π Õ∏ */
	$"C3B2 BFB7 D6D2 D4B7 B4D3 B3CB ABB7 BDB5"            /* √≤ø∑÷“‘∑¥”≥À´∑Ωµ */
	$"C4D4 ADD2 E2A3 ACC6 E4D3 E0CC F5BF EEC8"            /* ƒ‘≠“‚£¨∆‰”‡ÃıøÓ» */
	$"D4BE DFD3 D0CD EAC8 ABD6 AED0 A7C1 A6A1"            /* ‘æﬂ”–ÕÍ»´÷Æ–ß¡¶° */
	$"A328 6529 20C8 E7B9 FBC8 CEBA CED2 BBB7"            /* £(e) »Áπ˚»Œ∫Œ“ª∑ */
	$"BDD2 BBB4 CEBF EDC3 E2B1 BED0 EDBF C9D0"            /* Ω“ª¥ŒøÌ√‚±æ–Ìø…– */
	$"ADD2 E9B5 C4C8 CEBA CECC F5BF EEBB F2CC"            /* ≠“Èµƒ»Œ∫ŒÃıøÓªÚÃ */
	$"F5BC FEBB F2CE A5B9 E6D0 D0CE AAA3 ACB8"            /* ıº˛ªÚŒ•πÊ––Œ™£¨∏ */
	$"C3CF EEBF EDC3 E2C6 E4BA F3BD ABB2 BBD4"            /* √œÓøÌ√‚∆‰∫ÛΩ´≤ª‘ */
	$"D9BF EDC3 E2B8 C3B5 C8CC F5BF EEBB F2CC"            /* ŸøÌ√‚∏√µ»ÃıøÓªÚÃ */
	$"F5BC FEBB F2C6 E4BA F3B5 C4CE A5B9 E6D0"            /* ıº˛ªÚ∆‰∫ÛµƒŒ•πÊ– */
	$"D0CE AAA1 A328 6629 20B3 FDB7 C7B7 A8C2"            /* –Œ™°£(f) ≥˝∑«∑®¬ */
	$"C9C1 EDD3 D0B9 E6B6 A8A3 ACB1 BED0 EDBF"            /* …¡Ì”–πÊ∂®£¨±æ–Ìø */
	$"C9D0 ADD2 E9CA B9D3 C3B5 C4D3 EFD1 D4CA"            /* …–≠“È π”√µƒ”Ô—‘  */
	$"C7D3 A2D3 EFA1 A328 6729 20C4 FABF C9BD"            /* «”¢”Ô°£(g) ƒ˙ø…Ω */
	$"ABB1 BED0 EDBF C9D0 ADD2 E9CF C2B5 C4C8"            /* ´±æ–Ìø…–≠“Èœ¬µƒ» */
	$"A8C0 FBD7 AAC8 C3B8 F8CD ACD2 E2C6 E4CC"            /* ®¿˚◊™»√∏¯Õ¨“‚∆‰Ã */
	$"F5BF EEBA CDCD ACD2 E2CA DCC6 E4CC F5BF"            /* ıøÓ∫ÕÕ¨“‚ ‹∆‰Ãıø */
	$"EED4 BCCA F8B5 C4C8 CEBA CED2 BBB7 BDA1"            /* Ó‘º ¯µƒ»Œ∫Œ“ª∑Ω° */
	$"A34D 6F7A 696C 6C61 2046 6F75 6E64 6174"            /* £Mozilla Foundat */
	$"696F 6EBF C9CE DECC F5BC FEB5 D8D7 AAC8"            /* ionø…ŒﬁÃıº˛µÿ◊™» */
	$"C3B1 BED0 EDBF C9D0 ADD2 E9CF C2B5 C4C8"            /* √±æ–Ìø…–≠“Èœ¬µƒ» */
	$"A8C0 FBA1 A328 6829 20B1 BED0 EDBF C9D0"            /* ®¿˚°£(h) ±æ–Ìø…– */
	$"ADD2 E9BD ABB6 D4B8 F7B7 BDA1 A2C6 E4BC"            /* ≠“ÈΩ´∂‘∏˜∑Ω°¢∆‰º */
	$"CCB3 D0C8 CBBA CDD4 CAD0 EDB5 C4CA DCC8"            /* Ã≥–»À∫Õ‘ –Ìµƒ ‹» */
	$"C3C8 CBBE DFD4 BCCA F8C1 A6A3 ACB2 A2BD"            /* √»Àæﬂ‘º ¯¡¶£¨≤¢Ω */
	$"ABB7 FBBA CFC6 E4C0 FBD2 E6A1 A3"                   /* ´∑˚∫œ∆‰¿˚“Ê°£ */
};

data 'styl' (5007, "Simplified Chinese SLA") {
	$"00AC 0000 0000 000C 000A 9339 0090 000C"            /* .¨.......¬ì9.ê.. */
	$"0000 0000 0000 0000 0004 000F 000C 0400"            /* ................ */
	$"0090 000C 0000 0000 0000 0000 000A 000C"            /* .ê...........¬.. */
	$"000A 9339 0090 000C 0000 0000 0000 0000"            /* .¬ì9.ê.......... */
	$"0038 000F 000C 0400 0090 000C 0000 0000"            /* .8.......ê...... */
	$"0000 0000 003E 000C 000A 9339 0090 000C"            /* .....>...¬ì9.ê.. */
	$"0000 0000 0000 0000 00AC 000F 000C 0400"            /* .........¨...... */
	$"0090 000C 0000 0000 0000 0000 00B2 000C"            /* .ê...........≤.. */
	$"000A 9339 0090 000C 0000 0000 0000 0000"            /* .¬ì9.ê.......... */
	$"00C4 000F 000C 0400 0190 000C 0000 0000"            /* .ƒ.......ê...... */
	$"0000 0000 00CA 0012 000B 84C1 0090 000C"            /* ..... ....Ñ¡.ê.. */
	$"0000 0000 0000 0000 00CC 000C 000A 9339"            /* .........Ã...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 00DD 000F"            /* .ê...........›.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"00E0 000C 000A 9339 0090 000C 0000 0000"            /* .‡...¬ì9.ê...... */
	$"0000 0000 00E8 000F 000C 0400 0090 000C"            /* .....Ë.......ê.. */
	$"0000 0000 0000 0000 00EF 000C 000A 9339"            /* .........Ô...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 0111 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0118 000C 000A 9339 0090 000C 0000 0000"            /* .....¬ì9.ê...... */
	$"0000 0000 011A 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 0129 000C 000A 9339"            /* .........)...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 0135 000F"            /* .ê...........5.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"013B 000C 000A 9339 0090 000C 0000 0000"            /* .;...¬ì9.ê...... */
	$"0000 0000 0171 000F 000C 0400 0090 000C"            /* .....q.......ê.. */
	$"0000 0000 0000 0000 0177 000C 000A 9339"            /* .........w...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 0197 000F"            /* .ê...........ó.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0198 000C 000A 9339 0090 000C 0000 0000"            /* .ò...¬ì9.ê...... */
	$"0000 0000 019C 000F 000C 0400 0090 000C"            /* .....ú.......ê.. */
	$"0000 0000 0000 0000 019D 000C 000A 9339"            /* .........ù...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 01A7 000F"            /* .ê...........ß.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"01AD 000C 000A 9339 0090 000C 0000 0000"            /* .≠...¬ì9.ê...... */
	$"0000 0000 01C7 000F 000C 0400 0090 000C"            /* .....«.......ê.. */
	$"0000 0000 0000 0000 01C8 000C 000A 9339"            /* .........»...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 01D0 000F"            /* .ê...........–.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"01D1 000C 000A 9339 0090 000C 0000 0000"            /* .—...¬ì9.ê...... */
	$"0000 0000 01ED 000F 000C 0400 0090 000C"            /* .....Ì.......ê.. */
	$"0000 0000 0000 0000 01EE 000C 000A 9339"            /* .........Ó...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 01F2 000F"            /* .ê...........Ú.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"01F3 000C 000A 9339 0090 000C 0000 0000"            /* .Û...¬ì9.ê...... */
	$"0000 0000 0207 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 020D 000C 000A 9339"            /* .............¬ì9 */
	$"0090 000C 0000 0000 0000 0000 0269 000F"            /* .ê...........i.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"026A 000C 000A 9339 0090 000C 0000 0000"            /* .j...¬ì9.ê...... */
	$"0000 0000 026E 000F 000C 0400 0090 000C"            /* .....n.......ê.. */
	$"0000 0000 0000 0000 026F 000C 000A 9339"            /* .........o...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 0285 000F"            /* .ê...........Ö.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"028B 000C 000A 9339 0090 000C 0000 0000"            /* .ã...¬ì9.ê...... */
	$"0000 0000 02A3 000F 000C 0400 0090 000C"            /* .....£.......ê.. */
	$"0000 0000 0000 0000 02A9 000C 000A 9339"            /* .........©...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 0317 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"031A 000C 000A 9339 0090 000C 0000 0000"            /* .....¬ì9.ê...... */
	$"0000 0000 0326 000F 000C 0400 0090 000C"            /* .....&.......ê.. */
	$"0000 0000 0000 0000 0339 000C 000A 9339"            /* .........9...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 0373 000F"            /* .ê...........s.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"037A 000C 000A 9339 0090 000C 0000 0000"            /* .z...¬ì9.ê...... */
	$"0000 0000 03F0 000F 000C 0400 0090 000C"            /* ............ê.. */
	$"0000 0000 0000 0000 03F3 000C 000A 9339"            /* .........Û...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 03F7 000F"            /* .ê...........˜.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"03F8 000C 000A 9339 0090 000C 0000 0000"            /* .¯...¬ì9.ê...... */
	$"0000 0000 0452 000F 000C 0400 0090 000C"            /* .....R.......ê.. */
	$"0000 0000 0000 0000 0453 000C 000A 9339"            /* .........S...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 0455 000F"            /* .ê...........U.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0456 000C 000A 9339 0090 000C 0000 0000"            /* .V...¬ì9.ê...... */
	$"0000 0000 0462 000F 000C 0400 0090 000C"            /* .....b.......ê.. */
	$"0000 0000 0000 0000 0463 000C 000A 9339"            /* .........c...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 04A7 000F"            /* .ê...........ß.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"04AA 000C 000A 9339 0090 000C 0000 0000"            /* .™...¬ì9.ê...... */
	$"0000 0000 04B0 000F 000C 0400 0090 000C"            /* .....∞.......ê.. */
	$"0000 0000 0000 0000 04B1 000C 000A 9339"            /* .........±...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 04C5 000F"            /* .ê...........≈.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"04CC 000C 000A 9339 0090 000C 0000 0000"            /* .Ã...¬ì9.ê...... */
	$"0000 0000 04EE 000F 000C 0400 0090 000C"            /* .....Ó.......ê.. */
	$"0000 0000 0000 0000 04EF 000C 000A 9339"            /* .........Ô...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 04FD 000F"            /* .ê...........˝.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"04FE 000C 000A 9339 0090 000C 0000 0000"            /* .˛...¬ì9.ê...... */
	$"0000 0000 0518 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 052E 000C 000A 9339"            /* .............¬ì9 */
	$"0090 000C 0000 0000 0000 0000 058C 000F"            /* .ê...........å.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0593 000C 000A 9339 0090 000C 0000 0000"            /* .ì...¬ì9.ê...... */
	$"0000 0000 0641 000F 000C 0400 0090 000C"            /* .....A.......ê.. */
	$"0000 0000 0000 0000 0648 000C 000A 9339"            /* .........H...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 066C 000F"            /* .ê...........l.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"066F 000C 000A 9339 0090 000C 0000 0000"            /* .o...¬ì9.ê...... */
	$"0000 0000 067B 000F 000C 0400 0090 000C"            /* .....{.......ê.. */
	$"0000 0000 0000 0000 067C 000C 000A 9339"            /* .........|...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 0690 000F"            /* .ê...........ê.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0691 000C 000A 9339 0090 000C 0000 0000"            /* .ë...¬ì9.ê...... */
	$"0000 0000 0695 000F 000C 0400 0090 000C"            /* .....ï.......ê.. */
	$"0000 0000 0000 0000 0696 000C 000A 9339"            /* .........ñ...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 06B0 000F"            /* .ê...........∞.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"06B7 000C 000A 9339 0090 000C 0000 0000"            /* .∑...¬ì9.ê...... */
	$"0000 0000 0807 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 080A 000C 000A 9339"            /* .........¬...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 0812 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0813 000C 000A 9339 0090 000C 0000 0000"            /* .....¬ì9.ê...... */
	$"0000 0000 0825 000F 000C 0400 0090 000C"            /* .....%.......ê.. */
	$"0000 0000 0000 0000 082C 000C 000A 9339"            /* .........,...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 085A 000F"            /* .ê...........Z.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0862 000C 000A 9339 0090 000C 0000 0000"            /* .b...¬ì9.ê...... */
	$"0000 0000 0866 000F 000C 0400 0090 000C"            /* .....f.......ê.. */
	$"0000 0000 0000 0000 0867 000C 000A 9339"            /* .........g...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 097D 000F"            /* .ê..........∆}.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0985 000C 000A 9339 0090 000C 0000 0000"            /* ∆Ö...¬ì9.ê...... */
	$"0000 0000 09AD 000F 000C 0400 0090 000C"            /* ....∆≠.......ê.. */
	$"0000 0000 0000 0000 09B0 000C 000A 9339"            /* ........∆∞...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 0A42 000F"            /* .ê..........¬B.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0A45 000C 000A 9339 0090 000C 0000 0000"            /* ¬E...¬ì9.ê...... */
	$"0000 0000 0A4D 000F 000C 0400 0090 000C"            /* ....¬M.......ê.. */
	$"0000 0000 0000 0000 0A4E 000C 000A 9339"            /* ........¬N...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 0AC2 000F"            /* .ê..........¬¬.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0AC5 000C 000A 9339 0090 000C 0000 0000"            /* ¬≈...¬ì9.ê...... */
	$"0000 0000 0AD1 000F 000C 0400 0090 000C"            /* ....¬—.......ê.. */
	$"0000 0000 0000 0000 0AD2 000C 000A 9339"            /* ........¬“...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 0AD4 000F"            /* .ê..........¬‘.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0AE3 000C 000A 9339 0090 000C 0000 0000"            /* ¬„...¬ì9.ê...... */
	$"0000 0000 0AF5 000F 000C 0400 0090 000C"            /* ....¬ı.......ê.. */
	$"0000 0000 0000 0000 0AF7 000C 000A 9339"            /* ........¬˜...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 0AFD 000F"            /* .ê..........¬˝.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0AFE 000C 000A 9339 0090 000C 0000 0000"            /* ¬˛...¬ì9.ê...... */
	$"0000 0000 0B04 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 0B14 000C 000A 9339"            /* .............¬ì9 */
	$"0090 000C 0000 0000 0000 0000 0B16 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0B1A 000C 000A 9339 0090 000C 0000 0000"            /* .....¬ì9.ê...... */
	$"0000 0000 0B1C 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 0B1D 000C 000A 9339"            /* .............¬ì9 */
	$"0090 000C 0000 0000 0000 0000 0B23 000F"            /* .ê...........#.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0B35 000C 000A 9339 0090 000C 0000 0000"            /* .5...¬ì9.ê...... */
	$"0000 0000 0B37 000F 000C 0400 0090 000C"            /* .....7.......ê.. */
	$"0000 0000 0000 0000 0B3B 000C 000A 9339"            /* .........;...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 0B3D 000F"            /* .ê...........=.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0B3E 000C 000A 9339 0090 000C 0000 0000"            /* .>...¬ì9.ê...... */
	$"0000 0000 0B48 000F 000C 0400 0090 000C"            /* .....H.......ê.. */
	$"0000 0000 0000 0000 0B49 000C 000A 9339"            /* .........I...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 0B55 000F"            /* .ê...........U.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0B56 000C 000A 9339 0090 000C 0000 0000"            /* .V...¬ì9.ê...... */
	$"0000 0000 0B5A 000F 000C 0400 0090 000C"            /* .....Z.......ê.. */
	$"0000 0000 0000 0000 0B5B 000C 000A 9339"            /* .........[...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 0B6B 000F"            /* .ê...........k.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0B6C 000C 000A 9339 0090 000C 0000 0000"            /* .l...¬ì9.ê...... */
	$"0000 0000 0B76 000F 000C 0400 0090 000C"            /* .....v.......ê.. */
	$"0000 0000 0000 0000 0B86 000C 000A 9339"            /* .........Ü...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 0B88 000F"            /* .ê...........à.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0B9F 000C 000A 9339 0090 000C 0000 0000"            /* .ü...¬ì9.ê...... */
	$"0000 0000 0BA1 000F 000C 0400 0090 000C"            /* .....°.......ê.. */
	$"0000 0000 0000 0000 0BA5 000C 000A 9339"            /* .........•...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 0BA7 000F"            /* .ê...........ß.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0BA8 000C 000A 9339 0090 000C 0000 0000"            /* .®...¬ì9.ê...... */
	$"0000 0000 0BAE 000F 000C 0400 0090 000C"            /* .....Æ.......ê.. */
	$"0000 0000 0000 0000 0BC0 000C 000A 9339"            /* .........¿...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 0C00 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0C03 000C 000A 9339 0090 000C 0000 0000"            /* .....¬ì9.ê...... */
	$"0000 0000 0C07 000F 000C 0400 0090 000C"            /* .............ê.. */
	$"0000 0000 0000 0000 0C0C 000C 000A 9339"            /* .............¬ì9 */
	$"0090 000C 0000 0000 0000 0000 0C1E 000F"            /* .ê.............. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0C25 000C 000A 9339 0090 000C 0000 0000"            /* .%...¬ì9.ê...... */
	$"0000 0000 0C4B 000F 000C 0400 0090 000C"            /* .....K.......ê.. */
	$"0000 0000 0000 0000 0C53 000C 000A 9339"            /* .........S...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 0C77 000F"            /* .ê...........w.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0C7B 000C 000A 9339 0090 000C 0000 0000"            /* .{...¬ì9.ê...... */
	$"0000 0000 0CCF 000F 000C 0400 0090 000C"            /* .....œ.......ê.. */
	$"0000 0000 0000 0000 0CD3 000C 000A 9339"            /* .........”...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 0CFD 000F"            /* .ê...........˝.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0D47 000C 000A 9339 0090 000C 0000 0000"            /* .G...¬ì9.ê...... */
	$"0000 0000 0D4F 000F 000C 0400 0090 000C"            /* .....O.......ê.. */
	$"0000 0000 0000 0000 0D53 000C 000A 9339"            /* .........S...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 0DC1 000F"            /* .ê...........¡.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0DC5 000C 000A 9339 0090 000C 0000 0000"            /* .≈...¬ì9.ê...... */
	$"0000 0000 0E35 000F 000C 0400 0090 000C"            /* .....5.......ê.. */
	$"0000 0000 0000 0000 0E39 000C 000A 9339"            /* .........9...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 0E67 000F"            /* .ê...........g.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0E6B 000C 000A 9339 0090 000C 0000 0000"            /* .k...¬ì9.ê...... */
	$"0000 0000 0EB1 000F 000C 0400 0090 000C"            /* .....±.......ê.. */
	$"0000 0000 0000 0000 0EC3 000C 000A 9339"            /* .........√...¬ì9 */
	$"0090 000C 0000 0000 0000 0000 0EE5 000F"            /* .ê...........Â.. */
	$"000C 0400 0090 000C 0000 0000 0000 0000"            /* .....ê.......... */
	$"0EE9 000C 000A 9339 0090 000C 0000 0000"            /* .È...¬ì9.ê...... */
	$"0000"                                               /* .. */
};

data 'TEXT' (5008, "Traditional Chinese SLA") {
	$"9487 90A5 4341 4D49 4E4F 8E67 9770 8ED2"            /* îáê•CAMINOégópé“ */
	$"8EF6 9EDC 8D87 96F1 9349 94F1 90B3 8EAE"            /* éˆû‹çáñÒìIîÒê≥éÆ */
	$"9286 95B6 E6A1 967B 8143 8F8A 3F96 BE97"            /* íÜï∂Ê°ñ{ÅCèä?ñæó */
	$"4CE8 908E 6797 7096 7B43 414D 494E 4F8D"            /* LËêégópñ{CAMINOç */
	$"898A 4C93 498E F69E DC9E 8A8A BC95 738B"            /* âäLìIéˆû‹ûääºïsã */
	$"EF96 4097 A59D C197 CD81 439C E491 FC88"            /* Ôñ@ó•ù¡óÕÅCú‰ë¸à */
	$"C889 BA96 CA93 498E 6797 708E D28E F69E"            /* »â∫ñ ìIégópé“éˆû */
	$"DC8D 8796 F189 7095 B68C B495 B688 D78F"            /* ‹çáñÒâpï∂å¥ï∂à◊è */
	$"8081 4291 528E A781 4389 E498 EC8A F396"            /* ÄÅBëRéßÅCâ‰òÏäÛñ */
	$"5D96 7BE6 A196 7B9B 9297 4C8F 958D 7592"            /* ]ñ{Ê°ñ{õíóLèïçuí */
	$"8695 B693 498E 6797 708E D28D 5897 B989"            /* Üï∂ìIégópé“çXóπâ */
	$"F043 414D 494E 4F93 498E 6797 708E D28E"            /* CAMINOìIégópé“é */
	$"F69E DC8D 8796 F181 420D 0D43 414D 494E"            /* ˆû‹çáñÒÅB..CAMIN */
	$"4F8E 6797 708E D293 EEE9 938E F69E DC8D"            /* Oégópé“ìÓÈìéˆû‹ç */
	$"8796 F10D 91E6 312E 3194 C50D 0D8D AA9D"            /* áñÒ.ëÊ1.1î≈..ç™ù */
	$"9F4D 4F5A 494C 4C41 8CF6 9770 8EF6 9EDC"            /* üMOZILLAåˆópéˆû‹ */
	$"9861 91B4 91BC 8A4A 95FA 8CB4 8E6E E1F9"            /* òaë¥ëºäJï˙å¥én·˘ */
	$"93EE E993 8EF6 9EDC 8143 4D4F 5A49 4C4C"            /* ìÓÈìéˆû‹ÅCMOZILL */
	$"418D DD57 5757 2E4D 4F5A 494C 4C41 2E4F"            /* Aç›WWW.MOZILLA.O */
	$"5247 96C6 94EF 92F1 8B9F 965E 8DB1 4341"            /* RGñ∆îÔíÒãüñ^ç±CA */
	$"4D49 4E4F E067 E654 8AED 8CF7 945C 9349"            /* MINO‡gÊTäÌå˜î\ìI */
	$"8CB4 8E6E 92F6 8EAE E1F9 94C5 967B 8143"            /* å¥éníˆéÆ·˘î≈ñ{ÅC */
	$"8B9F 3F8E 6797 7081 418F 4389 FC98 6195"            /* ãü?égópÅAèCâ¸òaï */
	$"AAE1 A281 420D 0DE7 AC95 8D93 4943 414D"            /* ™·¢ÅB..Á¨ïçìICAM */
	$"494E 4F8E B78D 733F 94C5 967B 9861 918A"            /* INOé∑çs?î≈ñ{òaëä */
	$"E890 9349 95B6 8C8F 8169 88C8 89BA 8AC8"            /* ËêìIï∂åèÅià»â∫ä» */
	$"E269 8175 3F95 6981 7681 6A94 548D AA9D"            /* ‚iÅu?ïiÅvÅjîTç™ù */
	$"9F96 7B43 414D 494E 4F93 EEE9 938E 6797"            /* üñ{CAMINOìÓÈìégó */
	$"708E D28E F69E DC8D 8796 F181 6988 C889"            /* pé“éˆû‹çáñÒÅià»â */
	$"BA8A C8E2 6981 758E F69E DC8D 8796 F181"            /* ∫ä»‚iÅuéˆû‹çáñÒÅ */
	$"7681 6A93 499E 8A8A BC92 F18B 9F81 4292"            /* vÅjìIûääºíÒãüÅBí */
	$"CA89 DF88 C288 EA89 BA81 7590 DA8E F381"            /*  âﬂà¬àÍâ∫Åuê⁄éÛÅ */
	$"7688 C2E7 E481 4388 BD8E D288 C0E5 E488"            /* và¬Á‰ÅCàΩé“à¿Â‰à */
	$"BD8E 6797 7043 414D 494E 4FE0 67E6 548A"            /* ΩégópCAMINO‡gÊTä */
	$"ED81 4391 A695 5C8E A63F 93AF 88D3 90DA"            /* ÌÅCë¶ï\é¶?ìØà”ê⁄ */
	$"8EF3 967B 8EF6 9EDC 8D87 96F1 9E8A 8ABC"            /* éÛñ{éˆû‹çáñÒûääº */
	$"9456 96F1 91A9 8142 9440 89CA 3F95 7393"            /* îVñÒë©ÅBî@â ?ïsì */
	$"AF88 D390 DA8E F396 7B8E F69E DC8D 8796"            /* Øà”ê⁄éÛñ{éˆû‹çáñ */
	$"F193 499E 8A8A BC98 619E 8A8C 8F81 4390"            /* ÒìIûääºòaûäåèÅCê */
	$"BF96 DC88 C281 7590 DA8E F381 7688 C2E7"            /* øñ‹à¬Åuê⁄éÛÅvà¬Á */
	$"E481 4396 E795 7397 7688 C0E5 E488 BD8E"            /* ‰ÅCñÁïsóvà¿Â‰àΩé */
	$"6797 7043 414D 494E 4FE0 67E6 548A ED93"            /* gópCAMINO‡gÊTäÌì */
	$"4994 4389 BD95 9495 AA81 428D DD88 C0E5"            /* IîCâΩïîï™ÅBç›à¿Â */
	$"E443 414D 494E 4F93 4989 DF92 F692 8688"            /* ‰CAMINOìIâﬂíˆíÜà */
	$"C88B 79E2 638C E393 498E 9E8A D481 433F"            /* »ãy‚cå„ìIéûä‘ÅC? */
	$"89C2 945C 89C2 88C8 9149 9DA2 88C0 E5E4"            /* â¬î\â¬à»ëIù¢à¿Â‰ */
	$"8BA6 8F95 8FB1 8FA4 92F1 8B9F 9349 91B4"            /* ã¶èïè±è§íÒãüìIë¥ */
	$"91BC 8CB3 8C8F 8143 88C0 E5E4 9861 8E67"            /* ëºå≥åèÅCà¿Â‰òaég */
	$"9770 8BA6 8F95 8FB1 8FA4 8CB3 8C8F 89C2"            /* ópã¶èïè±è§å≥åèâ¬ */
	$"945C 8EF3 91B4 91BC 8EF6 9EDC 8D87 96F1"            /* î\éÛë¥ëºéˆû‹çáñÒ */
	$"90A7 96F1 8142 0D0D 312E 208E 6797 709E"            /* êßñÒÅB..1. égópû */
	$"DC94 568E F697 5C20 4D6F 7A69 6C6C 6120"            /* ‹îVéˆó\ Mozilla  */
	$"466F 756E 6461 7469 6F6E 8EF6 975C 3F8E"            /* Foundationéˆó\?é */
	$"6797 7096 7B3F 9569 8EB7 8D73 3F94 C596"            /* gópñ{?ïié∑çs?î≈ñ */
	$"7B93 4994 F19B 9397 709E DC97 9881 4296"            /* {ìIîÒõìópû‹óòÅBñ */
	$"7B8E F69E DC8D 8796 F196 E79B 9290 A796"            /* {éˆû‹çáñÒñÁõíêßñ */
	$"F14D 6F7A 696C 6C61 9770 98D2 8EE6 91E3"            /* ÒMozillaópò“éÊë„ */
	$"9861 815E 88BD 95E2 8F5B 8CB4 8E6E 3F95"            /* òaÅ^àΩï‚è[å¥én?ï */
	$"6993 4993 EEE9 938F A18B 8981 438F 9C94"            /* iìIìÓÈìè°ãâÅCèúî */
	$"F18A 5993 998F A18B 893F 8A4F E7AC 958D"            /* ÒäYìôè°ãâ?äOÁ¨ïç */
	$"8EF6 9EDC 8D87 96F1 8142 8DDD 3F97 4C8E"            /* éˆû‹çáñÒÅBç›?óLé */
	$"F69E DC8D 8796 F193 498F EE8B B589 BA81"            /* ˆû‹çáñÒìIèÓãµâ∫Å */
	$"439B 928E F397 4CE8 908E F69E DC9E 8A8A"            /* CõíéÛóLËêéˆû‹ûää */
	$"BC93 4996 F191 A981 420D 0D32 2E20 8F49"            /* ºìIñÒë©ÅB..2. èI */
	$"8E7E 208E E13F 88E1 94BD 967B 8EF6 9EDC"            /* é~ é·?à·îΩñ{éˆû‹ */
	$"8D87 96F1 8143 9B92 97A7 91A6 8F49 8E7E"            /* çáñÒÅCõíóßë¶èIé~ */
	$"3F8E 6797 7096 7B3F 9569 9349 9EDC 9798"            /* ?égópñ{?ïiìIû‹óò */
	$"8143 9F78 907B 3F8D 7392 CA92 6D81 4388"            /* ÅCüxê{?çsí ímÅCà */
	$"D296 7B8E F69E DC8D 8796 F193 498F 8A97"            /* “ñ{éˆû‹çáñÒìIèäó */
	$"4C9E 8A95 B681 6991 E631 9269 8175 8E67"            /* Lûäï∂ÅiëÊ1íiÅuég */
	$"9770 9EDC 9456 8EF6 975C 8176 8F9C 8A4F"            /* ópû‹îVéˆó\ÅvèúäO */
	$"816A 8DDD 8F49 8E7E 8E67 9770 9EDC 8CE3"            /* Åjç›èIé~égópû‹å„ */
	$"9B92 98B9 9152 974C 9DC1 8142 9B9C 8E9E"            /* õíòπëRóLù¡ÅBõúéû */
	$"8143 3F95 4B90 7BE7 F79A CA96 7B3F 9569"            /* ÅC?ïKê{Á˜ö ñ{?ïi */
	$"9456 8F8A 974C 8D89 8A4C 8142 0D0D 332E"            /* îVèäóLçâäLÅB..3. */
	$"209B 9397 4C9E DC20 967B 3F95 6993 4995"            /*  õìóLû‹ ñ{?ïiìIï */
	$"9495 AA8C F794 5C8D AA9D 9F4D 6F7A 696C"            /* îï™å˜î\ç™ùüMozil */
	$"6C61 8CF6 9770 8EF6 9EDC 9861 91B4 91BC"            /* laåˆópéˆû‹òaë¥ëº */
	$"8A4A 95FA 8CB4 8E6E E1F9 8EF6 9EDC 8169"            /* äJï˙å¥én·˘éˆû‹Åi */
	$"939D E269 8175 8A4A 95FA 8CB4 8E6E E1F9"            /* ìù‚iÅuäJï˙å¥én·˘ */
	$"8EF6 9EDC 8176 816A 9349 9E8A 8ABC 8143"            /* éˆû‹ÅvÅjìIûääºÅC */
	$"88C8 8CB4 8E6E 92F6 8EAE E1F9 9349 8C60"            /* à»å¥éníˆéÆ·˘ìIå` */
	$"8EAE 8DDD 6874 7470 3A2F 2F77 7777 2E6D"            /* éÆç›http://www.m */
	$"6F7A 696C 6C61 2E6F 7267 8FE3 92F1 8B9F"            /* ozilla.orgè„íÒãü */
	$"8142 967B 8EF6 9EDC 8D87 96F1 9286 9349"            /* ÅBñ{éˆû‹çáñÒíÜìI */
	$"9443 89BD 9E8A 8ABC 9573 9CE4 9146 E7D7"            /* îCâΩûääºïsú‰ëFÁ◊ */
	$"88D7 8CC0 90A7 9443 89BD 8DAA 9D9F 8A4A"            /* à◊å¿êßîCâΩç™ùüäJ */
	$"95FA 8CB4 8E6E E1F9 8EF6 9EDC 8EF6 975C"            /* ï˙å¥én·˘éˆû‹éˆó\ */
	$"9349 9EDC 9798 8142 8F9C 8FE3 95B6 8F8A"            /* ìIû‹óòÅBèúè„ï∂èä */
	$"8F71 9456 8A4F 8143 4D6F 7A69 6C6C 618B"            /* èqîVäOÅCMozillaã */
	$"DE91 E395 5C96 7B90 6798 6191 B48E F69E"            /* ﬁë„ï\ñ{êgòaë¥éˆû */
	$"DC8E D295 DB97 AF96 7B3F 9569 9286 9349"            /* ‹é“ï€óØñ{?ïiíÜìI */
	$"8F8A 974C 9271 8C64 3F9E DC81 4388 D296"            /* èäóLíqåd?û‹ÅCà“ñ */
	$"7B8E F69E DC8D 8796 F196 BE95 B68E F697"            /* {éˆû‹çáñÒñæï∂éˆó */
	$"5C93 499E DC97 988F 9C8A 4F81 423F 9573"            /* \ìIû‹óòèúäOÅB?ïs */
	$"93BE 88DA 8F9C 88BD 8D58 89FC 3F95 6992"            /* ìæà⁄èúàΩçXâ¸?ïií */
	$"8688 BD8F E396 CA93 4994 4389 BD8F A495"            /* ÜàΩè„ñ ìIîCâΩè§ï */
	$"5781 4195 578E 8F81 4192 988D EC9E DC88"            /* WÅAïWéèÅAíòçÏû‹à */
	$"BD91 B491 BC9B 9397 4C9E DC92 CA92 6D81"            /* Ωë¥ëºõìóLû‹í ímÅ */
	$"4296 7B8E F69E DC8D 8796 F195 C096 A28E"            /* Bñ{éˆû‹çáñÒï¿ñ¢é */
	$"F69E DC3F 8E67 9770 4D6F 7A69 6C6C 6188"            /* ˆû‹?égópMozillaà */
	$"BD91 B48E F69E DC8E D293 498F A495 5781"            /* Ωë¥éˆû‹é“ìIè§ïWÅ */
	$"4195 9E96 B18F A495 5788 BD95 578E 8F81"            /* Aïûñ±è§ïWàΩïWéèÅ */
	$"420D 0D34 2E20 9D5E 95DB 96C6 90D3 E3DF"            /* B..4. ù^ï€ñ∆ê”„ﬂ */
	$"96BE 2096 7B3F 9569 9454 9841 93AF 8F8A"            /* ñæ ñ{?ïiîTòAìØèä */
	$"974C 8DF6 8CEB 8175 88CB 9EE9 8176 92F1"            /* óLçˆåÎÅuàÀûÈÅvíÒ */
	$"8B9F 8142 8DDD 9640 97A5 88F2 8B96 9349"            /* ãüÅBç›ñ@ó•àÚãñìI */
	$"94CD 9AA1 89BA 8143 4D4F 5A49 4C4C 418B"            /* îÕö°â∫ÅCMOZILLAã */
	$"7991 B495 AAE7 F78F A498 618E F69E DC8E"            /* yë¥ï™Á˜è§òaéˆû‹é */
	$"D28B DE8D 9FE3 DF96 BE81 4395 7395 8994"            /* “ãﬁçü„ﬂñæÅCïsïâî */
	$"4389 BDE4 6F96 7B3F 9569 974C E890 9456"            /* CâΩ‰oñ{?ïióLËêîV */
	$"96BE 8EA6 88BD E0D2 8EA6 9D5E 95DB 90D3"            /* ñæé¶àΩ‡“é¶ù^ï€ê” */
	$"9443 8143 95EF 8A87 9241 9573 8CC0 8997"            /* îCÅCïÔäáíAïså¿âó */
	$"3F95 6996 B3E0 EAE1 7281 4193 4B8D 878F"            /* ?ïiñ≥‡Í·rÅAìKçáè */
	$"A4E7 F781 4193 4B97 7089 9796 5E88 EA93"            /* §Á˜ÅAìKópâóñ^àÍì */
	$"C192 E897 7093 7288 BD95 7390 4E9E DC93"            /* ¡íËópìràΩïsêNû‹ì */
	$"499D 5E95 DB90 D394 4381 428E 8A89 9791"            /* Iù^ï€ê”îCÅBéäâóë */
	$"499D A296 7B3F 9569 8DEC 3F93 4997 7093"            /* Iù¢ñ{?ïiçÏ?ìIópì */
	$"7281 4388 C88B 7996 7B3F 9569 9349 9569"            /* rÅCà»ãyñ{?ïiìIïi */
	$"8EBF 9861 9DC1 945C 8143 3F90 7B8E A98D"            /* éøòaù¡î\ÅC?ê{é©ç */
	$"738F B39D 5E91 5395 9495 97E8 A881 4298"            /* sè≥ù^ëSïîïóË®ÅBò */
	$"D48A C794 4389 BD8B 7EE0 5A93 498E E597"            /* ‘ä«îCâΩã~‡ZìIéÂó */
	$"7697 7093 728E B89D C181 438D 9F8D 808C"            /* vópìré∏ù¡ÅCçüçÄå */
	$"C090 A798 B991 5293 4B97 7081 4296 5E8D"            /* ¿êßòπëRìKópÅBñ^ç */
	$"B18A C78A 8D99 BD95 C095 7388 F28B 9694"            /* ±ä«äçôΩï¿ïsàÚãñî */
	$"728F 9C88 BD8C C090 A7E0 D28E A69D 5E95"            /* rèúàΩå¿êß‡“é¶ù^ï */
	$"DB90 D394 4381 4388 F68D 9F8D 9F8D 8096"            /* €ê”îCÅCàˆçüçüçÄñ */
	$"C690 D3E3 DF96 BE89 C294 5C9B 943F 9573"            /* ∆ê”„ﬂñæâ¬î\õî?ïs */
	$"934B 9770 8142 0D0D 352E 2090 D394 438C"            /* ìKópÅB..5. ê”îCå */
	$"C090 A720 8F9C 94F1 9640 97A5 3F97 4C8B"            /* ¿êß èúîÒñ@ó•?óLã */
	$"4B92 E881 434D 4F5A 494C 4C41 88C8 8B79"            /* KíËÅCMOZILLAà»ãy */
	$"91B4 95AA E7F7 8FA4 8141 939F 8E96 8141"            /* ë¥ï™Á˜è§ÅAìüéñÅA */
	$"8EF6 9EDC 8ED2 8141 8B9F 9CE4 8FA4 9861"            /* éˆû‹é“ÅAãüú‰è§òa */
	$"91E3 979D 8169 939D E269 8175 4D4F 5A49"            /* ë„óùÅiìù‚iÅuMOZI */
	$"4C4C 418F 579A A381 7681 6A9B 9488 F696"            /* LLAèWö£ÅvÅjõîàˆñ */
	$"7B8E F69E DC8D 8796 F188 BD8E D28E 6797"            /* {éˆû‹çáñÒàΩé“égó */
	$"7088 BD96 B396 408E 6797 7096 7B3F 9569"            /* pàΩñ≥ñ@égópñ{?ïi */
	$"88BD 918A E890 8CB4 88F6 8F8A 3F90 B694"            /* àΩëäËêå¥àˆèä?ê∂î */
	$"5694 4389 BD8A D490 DA81 4193 C195 CA81"            /* VîCâΩä‘ê⁄ÅAì¡ï Å */
	$"4195 8DE7 AC81 4195 4B91 5288 BD92 A694"            /* AïçÁ¨ÅAïKëRàΩí¶î */
	$"B190 AB91 B98A 5181 6995 EF8A 8792 4195"            /* ±ê´ëπäQÅiïÔäáíAï */
	$"738C C089 9788 F68F A4E6 A391 B98E B881"            /* så¿âóàˆè§Ê£ëπé∏Å */
	$"419A 7A8B C692 869D D081 4197 988F 8191"            /* Aözã∆íÜù–ÅAóòèÅë */
	$"B98E B881 418E 9197 BF91 728E B88B 7993"            /* πé∏ÅAéëóøëré∏ãyì */
	$"64E4 498E B8E8 CB88 BD8C CC8F E18F 8A3F"            /* d‰Ié∏ËÀàΩåÃè·èä? */
	$"90B6 9456 91B9 8A51 816A 8A54 9573 9589"            /* ê∂îVëπäQÅjäTïsïâ */
	$"90D3 8143 91A6 8E67 8E96 90E6 8A6C 8D90"            /* ê”ÅCë¶égéñêÊälçê */
	$"926D 8A59 9399 91B9 8A51 E1A2 90B6 9456"            /* ímäYìôëπäQ·¢ê∂îV */
	$"89C2 945C 90AB 8143 8A8E 9573 985F 8DF5"            /* â¬î\ê´ÅCäéïsò_çı */
	$"8F9E 8F8A 8DAA 9D9F 9349 979D 9D9F 8169"            /* èûèäç™ùüìIóùùüÅi */
	$"8D87 96F1 8141 904E 9EDC 88BD 91B4 91BC"            /* çáñÒÅAêNû‹àΩë¥ëº */
	$"979D 9752 816A 9692 93AF 8142 4D4F 5A49"            /* óùóRÅjñíìØÅBMOZI */
	$"4C4C 4120 8F57 9AA3 88CB 967B 8EF6 9EDC"            /* LLA èWö£àÀñ{éˆû‹ */
	$"8D87 96F1 8F8A 9589 9456 9153 9594 90D3"            /* çáñÒèäïâîVëSïîê” */
	$"9443 8143 9B92 9573 92B4 89DF 3530 3094"            /* îCÅCõíïsí¥âﬂ500î */
	$"FC8C B3E4 6F3F 8DAA 9D9F 967B 8EF6 9EDC"            /* ¸å≥‰o?ç™ùüñ{éˆû‹ */
	$"9BDF 8E78 9574 8ABC 8D80 8169 9440 974C"            /* õﬂéxïtäºçÄÅiî@óL */
	$"816A 995F 8ED2 9286 9456 8A72 91E5 8ED2"            /* Åjô_é“íÜîVärëÂé“ */
	$"8142 965E 8DB1 8AC7 8A8D 99BD 95C0 9573"            /* ÅBñ^ç±ä«äçôΩï¿ïs */
	$"88F2 8B96 9472 8F9C 88BD 8CC0 90A7 958D"            /* àÚãñîrèúàΩå¿êßïç */
	$"E7AC 8141 954B 9152 88BD 93C1 95CA 91B9"            /* Á¨ÅAïKëRàΩì¡ï ëπ */
	$"8A51 90D3 9443 8143 88F6 8D9F 8D9F 8D80"            /* äQê”îCÅCàˆçüçüçÄ */
	$"90D3 9443 9472 8F9C 9861 8CC0 90A7 89C2"            /* ê”îCîrèúòaå¿êßâ¬ */
	$"945C 9B94 3F95 7393 4B97 7081 420D 0D36"            /* î\õî?ïsìKópÅB..6 */
	$"2E20 8F6F 8CFB 8AC7 90A7 2096 7B8E F69E"            /* . èoå˚ä«êß ñ{éˆû */
	$"DC8E F38F 8A97 4C93 4B97 7093 498F 6F8C"            /* ‹éÛèäóLìKópìIèoå */
	$"FB8C C090 A790 A796 F181 423F 954B 907B"            /* ˚å¿êßêßñÒÅB?ïKê{ */
	$"8F85 8EE7 94FC 9AA0 88BD 8A4F 9AA0 8B40"            /* èÖéÁî¸ö†àΩäOö†ã@ */
	$"8D5C 88BD 8AC7 979D E163 8BC7 974C E890"            /* ç\àΩä«óù·cã«óLËê */
	$"967B 3F95 6998 6191 B48E 6797 7093 498F"            /* ñ{?ïiòaë¥égópìIè */
	$"8A97 4C8F 6F93 FC8C FB96 4097 A581 418C"            /* äóLèoì¸å˚ñ@ó•ÅAå */
	$"C090 A798 618B 4B91 A581 420D 0D37 2E20"            /* ¿êßòaãKë•ÅB..7.  */
	$"94FC 9AA0 90AD 957B 8E67 9770 8ED2 2088"            /* î¸ö†ê≠ï{égópé“ à */
	$"CB34 3820 432E 462E 522E 2032 2E31 3031"            /* À48 C.F.R. 2.101 */
	$"9286 9349 92E8 8B60 8143 967B 3F95 6994"            /* íÜìIíËã`ÅCñ{?ïiî */
	$"5481 758F A497 7095 6981 7681 4395 EF8A"            /* TÅuè§ópïiÅvÅCïÔä */
	$"DC34 3820 432E 462E 522E 2031 322E 3231"            /* ‹48 C.F.R. 12.21 */
	$"3281 6931 3939 3594 4E39 8C8E 816A 9861"            /* 2Åi1995îN9åéÅjòa */
	$"3438 2043 2E46 2E52 2E20 3232 372E 3732"            /* 48 C.F.R. 227.72 */
	$"3032 8169 3139 3935 944E 368C 8E81 6A8F"            /* 02Åi1995îN6åéÅjè */
	$"8AE2 6994 5681 758F A497 7093 64E4 4993"            /* ä‚iîVÅuè§ópìd‰Iì */
	$"EEE9 9381 7688 C88B 7981 758F A497 7093"            /* ÓÈìÅvà»ãyÅuè§ópì */
	$"64E4 4993 EEE9 9395 B68C 8F81 7681 4288"            /* d‰IìÓÈìï∂åèÅvÅBà */
	$"D78A 6D95 DBE4 6F34 3820 432E 462E 522E"            /* ◊ämï€‰o48 C.F.R. */
	$"2031 322E 3231 3281 4134 3820 432E 462E"            /*  12.212ÅA48 C.F. */
	$"522E 2032 372E 3430 3528 6229 2832 2920"            /* R. 27.405(b)(2)  */
	$"8169 3139 3938 944E 368C 8E81 6A98 6134"            /* Åi1998îN6åéÅjòa4 */
	$"3820 432E 462E 522E 2032 3237 2E37 3230"            /* 8 C.F.R. 227.720 */
	$"3293 4988 EA92 7690 AB81 438F 8A97 4C94"            /* 2ìIàÍívê´ÅCèäóLî */
	$"FC9A A090 AD95 7B8E 6797 708E D28A 6C93"            /* ¸ö†ê≠ï{égópé“älì */
	$"BE96 7B3F 9569 8E9E 8143 91FC 9769 974C"            /* æñ{?ïiéûÅCë¸óióL */
	$"967B 95B6 8F8A 8F71 9349 9EDC 9798 8142"            /* ñ{ï∂èäèqìIû‹óòÅB */
	$"0D0D 382E 2091 B491 BC20 2861 2920 967B"            /* ..8. ë¥ëº (a) ñ{ */
	$"8EF6 9EDC 8D87 96F1 8D5C 90AC 3F98 614D"            /* éˆû‹çáñÒç\ê¨?òaM */
	$"6F7A 696C 6C61 9456 8AD4 8F41 9557 9349"            /* ozillaîVä‘èAïWìI */
	$"8E96 8D80 92F9 97A7 9349 8AAE 90AE 8BA6"            /* éñçÄí˘óßìIäÆêÆã¶ */
	$"8B63 8143 91FC 89C2 92CA 89DF 4D6F 7A69"            /* ãcÅCë¸â¬í âﬂMozi */
	$"6C6C 6120 8EF6 9EDC 9349 8D73 90AD 906C"            /* lla éˆû‹ìIçsê≠êl */
	$"88F5 E2D3 E1A2 9349 8F91 96CA 8F43 92F9"            /* àı‚”·¢ìIèëñ èCí˘ */
	$"8F91 8F43 89FC 8142 2862 2920 8F9C 94F1"            /* èëèCâ¸ÅB(b) èúîÒ */
	$"934B 9770 9640 97A5 8169 9440 974C 816A"            /* ìKópñ@ó•Åiî@óLÅj */
	$"3F97 4C8B 4B92 E881 4396 7B8E F69E DC8D"            /* ?óLãKíËÅCñ{éˆû‹ç */
	$"8796 F19B 928E F394 FC9A A089 C18F 4296"            /* áñÒõíéÛî¸ö†â¡èBñ */
	$"4097 A58A C78A 8D81 4388 D291 B496 4097"            /* @ó•ä«äçÅCà“ë¥ñ@ó */
	$"A58F D593 CB9E 8A95 B68F 9C8A 4F81 4228"            /* •è’ìÀûäï∂èúäOÅB( */
	$"6329 2096 7B8E F69E DC8D 8796 F195 738E"            /* c) ñ{éˆû‹çáñÒïsé */
	$"F397 FC8D 879A A09A A08D DB89 DD95 A8E7"            /* Ûó¸çáö†ö†ç€â›ï®Á */
	$"F79A 538D 8796 F18C F696 F181 6955 6E69"            /* ˜öSçáñÒåˆñÒÅiUni */
	$"7465 6420 4E61 7469 6F6E 7320 436F 6E76"            /* ted Nations Conv */
	$"656E 7469 6F6E 206F 6E20 436F 6E74 7261"            /* ention on Contra */
	$"6374 7320 666F 7220 7468 6520 496E 7465"            /* cts for the Inte */
	$"726E 6174 696F 6E61 6C20 5361 6C65 206F"            /* rnational Sale o */
	$"6620 476F 6F64 7381 6A90 A796 F181 4228"            /* f GoodsÅjêßñÒÅB( */
	$"6429 208E E196 7B8E F69E DC8D 8796 F192"            /* d) é·ñ{éˆû‹çáñÒí */
	$"8697 4C94 4389 BD9E 8A8A BCE3 538D D992"            /* ÜóLîCâΩûääº„SçŸí */
	$"E888 D795 738B EF9D C197 CD88 BD96 B396"            /* Ëà◊ïsãÔù¡óÕàΩñ≥ñ */
	$"408E B78D 738E 9E81 439B 9291 46E7 D78A"            /* @é∑çséûÅCõíëFÁ◊ä */
	$"5995 9495 AA88 C894 BD89 6699 D495 FB93"            /* Yïîï™à»îΩâfô‘ï˚ì */
	$"498C B488 D381 4391 B4E9 509E 8A8A BC98"            /* Iå¥à”ÅCë¥ÈPûääºò */
	$"B98B EF97 4C8A AE91 5394 569D C197 CD81"            /* πãÔóLäÆëSîVù¡óÕÅ */
	$"4228 6529 2094 4089 CA94 4389 BD88 EA95"            /* B(e) î@â îCâΩàÍï */
	$"FB88 EA8E 9F3F 96C6 967B 8EF6 9EDC 8D87"            /* ˚àÍéü?ñ∆ñ{éˆû‹çá */
	$"96F1 9349 9443 89BD 9E8A 8ABC 88BD 9E8A"            /* ñÒìIîCâΩûääºàΩûä */
	$"8C8F 88BD 88E1 8B4B 8D73 88D7 8143 8A59"            /* åèàΩà·ãKçsà◊ÅCäY */
	$"8D80 3F96 C691 B48C E39B 9295 738D C43F"            /* çÄ?ñ∆ë¥å„õíïsçƒ? */
	$"96C6 8A59 9399 9E8A 8ABC 88BD 9E8A 8C8F"            /* ñ∆äYìôûääºàΩûäåè */
	$"88BD 91B4 8CE3 9349 88E1 8B4B 8D73 88D7"            /* àΩë¥å„ìIà·ãKçsà◊ */
	$"8142 2866 2920 8F9C 94F1 9640 97A5 3F97"            /* ÅB(f) èúîÒñ@ó•?ó */
	$"4C8B 4B92 E881 4396 7B8E F69E DC8D 8796"            /* LãKíËÅCñ{éˆû‹çáñ */
	$"F18E 6797 7093 498C EA8C BE90 A589 708C"            /* ÒégópìIåÍåæê•âpå */
	$"EA81 4228 6729 203F 89C2 9B92 967B 8EF6"            /* ÍÅB(g) ?â¬õíñ{éˆ */
	$"9EDC 8D87 96F1 89BA 9349 9EDC 9798 E77A"            /* û‹çáñÒâ∫ìIû‹óòÁz */
	$"E6A8 8B8B 93AF 88D3 91B4 9E8A 8ABC 9861"            /* Ê®ããìØà”ë¥ûääºòa */
	$"93AF 88D3 8EF3 91B4 9E8A 8ABC 96F1 91A9"            /* ìØà”éÛë¥ûääºñÒë© */
	$"9349 9443 89BD 88EA 95FB 8142 4D6F 7A69"            /* ìIîCâΩàÍï˚ÅBMozi */
	$"6C6C 6120 466F 756E 6461 7469 6F6E 89C2"            /* lla Foundationâ¬ */
	$"96B3 9E8A 8C8F 926E E77A E6A8 967B 8EF6"            /* ñ≥ûäåèínÁzÊ®ñ{éˆ */
	$"9EDC 8D87 96F1 89BA 9349 9EDC 9798 8142"            /* û‹çáñÒâ∫ìIû‹óòÅB */
	$"2868 2920 967B 8EF6 9EDC 8D87 96F1 9B92"            /* (h) ñ{éˆû‹çáñÒõí */
	$"9B94 8A65 95FB 8141 91B4 E38B 8FB3 906C"            /* õîäeï˚ÅAë¥„ãè≥êl */
	$"9861 88F2 8B96 9349 8EF3 E6A8 906C 8BEF"            /* òaàÚãñìIéÛÊ®êlãÔ */
	$"96F1 91A9 97CD 8143 95C0 9B92 9584 8D87"            /* ñÒë©óÕÅCï¿õíïÑçá */
	$"91B4 9798 8976 8142"                                /* ë¥óòâvÅB */
};

data 'styl' (5008, "Traditional Chinese SLA") {
	$"0083 0000 0000 0012 000B 84C1 0090 000C"            /* .É........Ñ¡.ê.. */
	$"0000 0000 0000 0000 0004 000F 000C 0400"            /* ................ */
	$"0090 000C 0000 0000 0000 0000 000A 0012"            /* .ê...........¬.. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"0039 000F 000C 0400 0090 000C 0000 0000"            /* .9.......ê...... */
	$"0000 0000 003F 0012 000B 84C1 0090 000C"            /* .....?....Ñ¡.ê.. */
	$"0000 0000 0000 0000 00B1 000F 000C 0400"            /* .........±...... */
	$"0090 000C 0000 0000 0000 0000 00B7 0012"            /* .ê...........∑.. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"00CB 000F 000C 0400 0190 000C 0000 0000"            /* .À.......ê...... */
	$"0000 0000 00D1 0012 000B 8461 0090 000C"            /* .....—....Ña.ê.. */
	$"0000 0000 0000 0000 00E3 000F 000C 0400"            /* .........„...... */
	$"0090 000C 0000 0000 0000 0000 00E4 0012"            /* .ê...........‰.. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"00E6 000F 000C 0400 0090 000C 0000 0000"            /* .Ê.......ê...... */
	$"0000 0000 00E9 0012 000B 84C1 0090 000C"            /* .....È....Ñ¡.ê.. */
	$"0000 0000 0000 0000 00F1 000F 000C 0400"            /* .........Ò...... */
	$"0090 000C 0000 0000 0000 0000 00F8 0012"            /* .ê...........¯.. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"011A 000F 000C 0400 0090 000C 0000 0000"            /* .........ê...... */
	$"0000 0000 0121 0012 000B 84C1 0090 000C"            /* .....!....Ñ¡.ê.. */
	$"0000 0000 0000 0000 0123 000F 000C 0400"            /* .........#...... */
	$"0090 000C 0000 0000 0000 0000 0132 0012"            /* .ê...........2.. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"013E 000F 000C 0400 0090 000C 0000 0000"            /* .>.......ê...... */
	$"0000 0000 0144 0012 000B 84C1 0090 000C"            /* .....D....Ñ¡.ê.. */
	$"0000 0000 0000 0000 017D 000F 000C 0400"            /* .........}...... */
	$"0090 000C 0000 0000 0000 0000 0183 0012"            /* .ê...........É.. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"01B3 000F 000C 0400 0090 000C 0000 0000"            /* .≥.......ê...... */
	$"0000 0000 01B9 0012 000B 84C1 0090 000C"            /* .....π....Ñ¡.ê.. */
	$"0000 0000 0000 0000 0215 000F 000C 0400"            /* ................ */
	$"0090 000C 0000 0000 0000 0000 021B 0012"            /* .ê.............. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"0293 000F 000C 0400 0090 000C 0000 0000"            /* .ì.......ê...... */
	$"0000 0000 0299 0012 000B 84C1 0090 000C"            /* .....ô....Ñ¡.ê.. */
	$"0000 0000 0000 0000 02B1 000F 000C 0400"            /* .........±...... */
	$"0090 000C 0000 0000 0000 0000 02B7 0012"            /* .ê...........∑.. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"0328 000F 000C 0400 0090 000C 0000 0000"            /* .(.......ê...... */
	$"0000 0000 032B 0012 000B 84C1 0090 000C"            /* .....+....Ñ¡.ê.. */
	$"0000 0000 0000 0000 0337 000F 000C 0400"            /* .........7...... */
	$"0090 000C 0000 0000 0000 0000 034A 0012"            /* .ê...........J.. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"0381 000F 000C 0400 0090 000C 0000 0000"            /* .Å.......ê...... */
	$"0000 0000 0388 0012 000B 84C1 0090 000C"            /* .....à....Ñ¡.ê.. */
	$"0000 0000 0000 0000 03FB 000F 000C 0400"            /* .........˚...... */
	$"0090 000C 0000 0000 0000 0000 03FE 0012"            /* .ê...........˛.. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"0402 000F 000C 0400 0090 000C 0000 0000"            /* .........ê...... */
	$"0000 0000 0403 0012 000B 84C1 0090 000C"            /* ..........Ñ¡.ê.. */
	$"0000 0000 0000 0000 0459 000F 000C 0400"            /* .........Y...... */
	$"0090 000C 0000 0000 0000 0000 045A 0012"            /* .ê...........Z.. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"04AE 000F 000C 0400 0090 000C 0000 0000"            /* .Æ.......ê...... */
	$"0000 0000 04B1 0012 000B 84C1 0090 000C"            /* .....±....Ñ¡.ê.. */
	$"0000 0000 0000 0000 04B7 000F 000C 0400"            /* .........∑...... */
	$"0090 000C 0000 0000 0000 0000 04B8 0012"            /* .ê...........∏.. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"04CB 000F 000C 0400 0090 000C 0000 0000"            /* .À.......ê...... */
	$"0000 0000 04D2 0012 000B 84C1 0090 000C"            /* .....“....Ñ¡.ê.. */
	$"0000 0000 0000 0000 0524 000F 000C 0400"            /* .........$...... */
	$"0090 000C 0000 0000 0000 0000 053A 0012"            /* .ê...........:.. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"0598 000F 000C 0400 0090 000C 0000 0000"            /* .ò.......ê...... */
	$"0000 0000 059F 0012 000B 84C1 0090 000C"            /* .....ü....Ñ¡.ê.. */
	$"0000 0000 0000 0000 0648 000F 000C 0400"            /* .........H...... */
	$"0090 000C 0000 0000 0000 0000 064F 0012"            /* .ê...........O.. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"0673 000F 000C 0400 0090 000C 0000 0000"            /* .s.......ê...... */
	$"0000 0000 0676 0012 000B 84C1 0090 000C"            /* .....v....Ñ¡.ê.. */
	$"0000 0000 0000 0000 0682 000F 000C 0400"            /* .........Ç...... */
	$"0090 000C 0000 0000 0000 0000 0683 0012"            /* .ê...........É.. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"06B8 000F 000C 0400 0090 000C 0000 0000"            /* .∏.......ê...... */
	$"0000 0000 06BF 0012 000B 84C1 0090 000C"            /* .....ø....Ñ¡.ê.. */
	$"0000 0000 0000 0000 0808 000F 000C 0400"            /* ................ */
	$"0090 000C 0000 0000 0000 0000 080B 0012"            /* .ê.............. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"0813 000F 000C 0400 0090 000C 0000 0000"            /* .........ê...... */
	$"0000 0000 0814 0012 000B 84C1 0090 000C"            /* ..........Ñ¡.ê.. */
	$"0000 0000 0000 0000 0825 000F 000C 0400"            /* .........%...... */
	$"0090 000C 0000 0000 0000 0000 082C 0012"            /* .ê...........,.. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"085C 000F 000C 0400 0090 000C 0000 0000"            /* .\.......ê...... */
	$"0000 0000 0863 0012 000B 84C1 0090 000C"            /* .....c....Ñ¡.ê.. */
	$"0000 0000 0000 0000 097C 000F 000C 0400"            /* ........∆|...... */
	$"0090 000C 0000 0000 0000 0000 0984 0012"            /* .ê..........∆Ñ.. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"09AC 000F 000C 0400 0090 000C 0000 0000"            /* ∆¨.......ê...... */
	$"0000 0000 09AF 0012 000B 84C1 0090 000C"            /* ....∆Ø....Ñ¡.ê.. */
	$"0000 0000 0000 0000 0A3F 000F 000C 0400"            /* ........¬?...... */
	$"0090 000C 0000 0000 0000 0000 0A42 0012"            /* .ê..........¬B.. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"0A4A 000F 000C 0400 0090 000C 0000 0000"            /* ¬J.......ê...... */
	$"0000 0000 0A4B 0012 000B 84C1 0090 000C"            /* ....¬K....Ñ¡.ê.. */
	$"0000 0000 0000 0000 0ABD 000F 000C 0400"            /* ........¬Ω...... */
	$"0090 000C 0000 0000 0000 0000 0AC0 0012"            /* .ê..........¬¿.. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"0ACE 000F 000C 0400 0090 000C 0000 0000"            /* ¬Œ.......ê...... */
	$"0000 0000 0ACF 0012 000B 84C1 0090 000C"            /* ....¬œ....Ñ¡.ê.. */
	$"0000 0000 0000 0000 0AD1 000F 000C 0400"            /* ........¬—...... */
	$"0090 000C 0000 0000 0000 0000 0AE0 0012"            /* .ê..........¬‡.. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"0B01 000F 000C 0400 0090 000C 0000 0000"            /* .........ê...... */
	$"0000 0000 0B11 0012 000B 84C1 0090 000C"            /* ..........Ñ¡.ê.. */
	$"0000 0000 0000 0000 0B13 000F 000C 0400"            /* ................ */
	$"0090 000C 0000 0000 0000 0000 0B17 0012"            /* .ê.............. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"0B19 000F 000C 0400 0090 000C 0000 0000"            /* .........ê...... */
	$"0000 0000 0B1A 0012 000B 84C1 0090 000C"            /* ..........Ñ¡.ê.. */
	$"0000 0000 0000 0000 0B20 000F 000C 0400"            /* ......... ...... */
	$"0090 000C 0000 0000 0000 0000 0B32 0012"            /* .ê...........2.. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"0B34 000F 000C 0400 0090 000C 0000 0000"            /* .4.......ê...... */
	$"0000 0000 0B38 0012 000B 84C1 0090 000C"            /* .....8....Ñ¡.ê.. */
	$"0000 0000 0000 0000 0B3A 000F 000C 0400"            /* .........:...... */
	$"0090 000C 0000 0000 0000 0000 0B3B 0012"            /* .ê...........;.. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"0B77 000F 000C 0400 0090 000C 0000 0000"            /* .w.......ê...... */
	$"0000 0000 0B87 0012 000B 84C1 0090 000C"            /* .....á....Ñ¡.ê.. */
	$"0000 0000 0000 0000 0B89 000F 000C 0400"            /* .........â...... */
	$"0090 000C 0000 0000 0000 0000 0BA0 0012"            /* .ê...........†.. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"0BA2 000F 000C 0400 0090 000C 0000 0000"            /* .¢.......ê...... */
	$"0000 0000 0BA6 0012 000B 84C1 0090 000C"            /* .....¶....Ñ¡.ê.. */
	$"0000 0000 0000 0000 0BA8 000F 000C 0400"            /* .........®...... */
	$"0090 000C 0000 0000 0000 0000 0BA9 0012"            /* .ê...........©.. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"0BAF 000F 000C 0400 0090 000C 0000 0000"            /* .Ø.......ê...... */
	$"0000 0000 0BC1 0012 000B 84C1 0090 000C"            /* .....¡....Ñ¡.ê.. */
	$"0000 0000 0000 0000 0C02 000F 000C 0400"            /* ................ */
	$"0090 000C 0000 0000 0000 0000 0C05 0012"            /* .ê.............. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"0C09 000F 000C 0400 0090 000C 0000 0000"            /* .∆.......ê...... */
	$"0000 0000 0C0E 0012 000B 84C1 0090 000C"            /* ..........Ñ¡.ê.. */
	$"0000 0000 0000 0000 0C1F 000F 000C 0400"            /* ................ */
	$"0090 000C 0000 0000 0000 0000 0C26 0012"            /* .ê...........&.. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"0C4C 000F 000C 0400 0090 000C 0000 0000"            /* .L.......ê...... */
	$"0000 0000 0C54 0012 000B 84C1 0090 000C"            /* .....T....Ñ¡.ê.. */
	$"0000 0000 0000 0000 0C78 000F 000C 0400"            /* .........x...... */
	$"0090 000C 0000 0000 0000 0000 0C7C 0012"            /* .ê...........|.. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"0CCF 000F 000C 0400 0090 000C 0000 0000"            /* .œ.......ê...... */
	$"0000 0000 0CD3 0012 000B 84C1 0090 000C"            /* .....”....Ñ¡.ê.. */
	$"0000 0000 0000 0000 0CFD 000F 000C 0400"            /* .........˝...... */
	$"0090 000C 0000 0000 0000 0000 0D47 0012"            /* .ê...........G.. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"0D4F 000F 000C 0400 0090 000C 0000 0000"            /* .O.......ê...... */
	$"0000 0000 0D53 0012 000B 84C1 0090 000C"            /* .....S....Ñ¡.ê.. */
	$"0000 0000 0000 0000 0DC1 000F 000C 0400"            /* .........¡...... */
	$"0090 000C 0000 0000 0000 0000 0DC5 0012"            /* .ê...........≈.. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"0E32 000F 000C 0400 0090 000C 0000 0000"            /* .2.......ê...... */
	$"0000 0000 0E36 0012 000B 84C1 0090 000C"            /* .....6....Ñ¡.ê.. */
	$"0000 0000 0000 0000 0E63 000F 000C 0400"            /* .........c...... */
	$"0090 000C 0000 0000 0000 0000 0E67 0012"            /* .ê...........g.. */
	$"000B 84C1 0090 000C 0000 0000 0000 0000"            /* ..Ñ¡.ê.......... */
	$"0EAC 000F 000C 0400 0090 000C 0000 0000"            /* .¨.......ê...... */
	$"0000 0000 0EBE 0012 000B 84C1 0090 000C"            /* .....æ....Ñ¡.ê.. */
	$"0000 0000 0000 0000 0EE0 000F 000C 0400"            /* .........‡...... */
	$"0090 000C 0000 0000 0000 0000 0EE4 0012"            /* .ê...........‰.. */
	$"000B 84C1 0090 000C 0000 0000 0000"                 /* ..Ñ¡.ê........ */
};

