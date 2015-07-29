DONE:
1. Jul 24: First version done.
2. Jul 27: Login patch done.
3. Jul 28: A way to deal with the login problem is to look for cookies stored by this site, and disable check if there
is any. This may have false negative, but will be efficient.
4. Jul 28: If current page is Google search, and user clicks on some website, we can look for the clicked URL and
promised URL. When user click on the clicked URL, the website will check the domain of the promised one against the
actual one, if they are different, then warn (ad syndication).

TODO:
0. Render spider view on click. Maybe place inside address bar? or on extension icon?
1. Send multiple spider copies.
2. Support multiple modes and use a button to let user choose mode.
3. Build a naive server that requests page and answers (moon.gtisc.gatech.edu).
4. Check whether there is other signals that we can use.
5. Discuss and see whether it is necessary to publish to Chrome webstore https://developer.chrome.com/webstore/publish
6. How to selectively change headers for background script.
7. Enable or disable log in checks
