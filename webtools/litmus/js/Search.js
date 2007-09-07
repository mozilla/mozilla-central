function rewriteLinksByClassName(className,URL) {
    links = document.getElementsByClassName(className);
    if (links) {
        for (var i=0; i< links.length; i++) {
            if (!links[i]) {
                continue;
            }
            links[i].href = URL;
        }
    }
}

