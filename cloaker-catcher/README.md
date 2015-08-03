# cloaker-catcher
This is an chrome plugin that help user determine whether the visited landing page
(linked from Google search or Google search advertisements) is cloaking or not,
by comparing what search engine sees with what user sees.

The detailed design document is available in the following link:
https://docs.google.com/document/d/1OQymxxqX0_yhk9rahhkT9w6eRKGLIrtPMmIppFoO95E/edit?usp=sharing

It has several working mode.

1. Offline:
	a. compare the landing URL against the blacklist. If hit, warn user.
	
	b. if not hit, compare agasint a whitelist. If hit, pass.
	
	c. if no data available, fetch the link with spider user agent, check if it is Login page that we want to ignore,
	i.e. user visited this page before and it contains a login keyword in spider copy. If yes, pass.
	
	d. Compare the dom and text between spider copy and user copy, if significantly different,
	report to user, and let user decide.

2. Online:
	Similar to Offline, except that spider copy crawling is done at server side.

3. Unguarded:
	Turn off this plugin.
