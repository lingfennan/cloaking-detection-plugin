# cloaking-detection-plugin
This is an chrome plugin that help user determine whether the visited landing page
(linked from Google search or Google search advertisements) is cloaking or not,
by comparing what search engine sees with what user sees.

It has several working mode.
1. Offline: 
	a. compare the landing URL against the blacklist. If hit, warn user.
	b. if not hit, compare agasint a whitelist. If hit, pass.
	c. if no data available, fetch the link with spider user agent and
	normal user agent. Compare the dom and text, if significantly different,
	report to user, and let user decide.


