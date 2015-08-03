DONE:
1. Jul 24: First version done.
2. Jul 27: Login patch done.
3. Jul 28: A way to deal with the login problem is to look for cookies stored by this site, and disable check if there
is any. This may have false negative, but will be efficient.
4. Jul 28: If current page is Google search, and user clicks on some website, we can look for the clicked URL and
promised URL. When user click on the clicked URL, the website will check the domain of the promised one against the
actual one, if they are different, then warn (ad syndication).
5. Render spider view on click. Maybe place inside address bar? or on extension icon? No need.
6. Send multiple spider copies. Useless, always the same.
7. Support multiple modes and use a button to let user choose mode.

TODO:
1. Background support for multiple mode.
2. Build a naive server that requests page and answers (moon.gtisc.gatech.edu).
3. Check whether there is other signals that we can use.
4. Discuss and see whether it is necessary to publish to Chrome webstore https://developer.chrome.com/webstore/publish
5. How to selectively change headers for background script.
6. Enable or disable log in checks.
7. Implement the algorithm part in dagger.