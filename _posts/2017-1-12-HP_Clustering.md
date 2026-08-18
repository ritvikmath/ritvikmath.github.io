---
layout: post
comments: true
title: Detecting Communities in the Harry Potter Universe
image: /images/both.png
category: culture
authors_choice: true
summary: Using dialogue and text distance to uncover the hidden communities of the Harry Potter universe.
search_terms: Harry Potter Hogwarts books novels text analysis natural language processing NLP clustering machine learning unsupervised learning dialogue characters communities distance similarity networks wizarding world literature
---

<figure>
<center>
   <a href="/images/both.png"><img width="100%" src="/images/both.png"></a>
</center>
</figure>

<center>
<font size="5"><b>Using Text Distances to Cluster Characters in the Wizarding World</b></font>
</center>

<script type="text/x-mathjax-config">
  MathJax.Hub.Config({
  tex2jax: {
    inlineMath: [['$','$'], ['\\(','\\)']],
    processEscapes: true
  }
});
</script>
<script type="text/javascript" async
  src="https://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-AMS_CHTML">
</script>

---

Quick Links: 

* [How Similar are Two Characters in the Wizarding World?](#wiz)  
* [Uncovering Hidden Wizarding Communities](#comm)
* [How Important is each Character?](#imp)

---

<a name="wiz"></a>

# How Similar are Two Characters in the Wizarding World?

<figure>
<center>
   <a href="/images/friends.png"><img width="80%" src="/images/friends.png"></a>
</center>
</figure>

In the popular book series, *Harry Potter*, author J.K. Rowling brings to life countless diverse and exciting characters connected by their co-inhabitance in a wizarding world. It is clear to readers of even just the first book that the protagonist trio of wizards, Harry, Ron, and Hermione form a tight knit community within this universe. It may be more unclear however, the exact nature of the communities that many of the other inhabitants of this world belong to. This post aims to detect the underlying communities in the Harry Potter universe using a very intuitive measure: text distances. 

Let's get into it with an example.

Suppose we wish to find the similarity between the main protagonist, Harry Potter, and his best friend, Ron Weasley. We will measure this similarity across all seven books in the series, one book at a time. 

We start by scanning through the first book in the series, *The Sorcerer’s Stone*, and creating a list of each index which is the word 'Harry'. For example, just for the sake of example, suppose 'Harry' is the 1st, 10th, 100th, and 1000th word of this book. Then, we get the list: [1, 10, 100, 1000]. 

We now do the same for 'Ron'. Suppose we get [5, 20, 150] (note in our example, 'Ron' only occurs three times while 'Harry' occurs four times). 

Now we wish to find the similarity between Harry and Ron. We do this in two steps, the results of which we average for our final answer. First, we scan through Harry's list, [1, 10, 100, 1000], and for each number, we find the smallest absolute difference with any number in Ron's list. If that sounds confusing, let's dive in and do the work! 

Since 1 is the first number in Harry's list, we look through Ron's list and subtract 1 from each number there. We then report back the smallest absolute value we find. We see that choosing Ron's 5 gives us an absolute difference of 4, choosing Ron' 20 gives an absolute difference of 19, and choosing Ron's 150 gives and absolute difference of 149, so we choose the 5 and record the absolute difference of 4 in another list: [4].

Now, we look at Harry's second element, which is 10 and choose Ron's 5 again, so that our absolute difference list is now [4, 5]. We then consider Harry's 100 and 1000 so that our final absolute difference list reads: [4, 5, 50, 850]. Now, what do these numbers represent? They really represent the closet occurrence of 'Ron' to each occurrence of 'Harry'. If we want an 'average' of such measures, we can take the median of this list, which happens to be 27.5. That is, 'Ron' is, on average, 27.5 words away from 'Harry'. 

Now, we repeat this process but considering Ron first and Harry second. So, we consider Ron's 5, which is closest to Harry's 1, then consider Ron's 20, closest to Harry's 10, and finally Ron's 150, closest to Harry's 100. Then, Ron's absolute differences list is: [4, 10, 50], whose median is 10. So, on average 'Harry' is 10 words away from 'Ron' in our example. We now take the mean of our Harry-Ron distance and Ron-Harry distance to get our Harry and Ron similarity score. In this case, it is the average of 27.5 and 10 which is 18.75. So, the similarity between Harry and Ron is 18.75. 

We (or rather, a computer) can go through the process above for all seven books for any two characters in the Harry Potter world and find one number which tells us how similar these two characters are. 

And then, the fun can begin.

---

<a name="comm"></a>

# Uncovering Hidden Wizarding Communities

Based on the similarities we derived in the previous section, we can use a powerful mathematical grouping technique called <a href="https://en.wikipedia.org/wiki/Spectral_clustering" target="_blank">spectral clustering</a> to identify naturally occurring communities in the Harry Potter universe. That is, we are able to identify communities whose members are more similar to each other than the members in other communities. The result is shown below for 7 communities.

<figure>
<center>
   <a href="/images/fullgraph.png"><img width="100%" src="/images/fullgraph.png"></a>
</center>
</figure>

We see some interesting stuff:

* Of course Harry, Ron, and Hermione are in the same group
* The bottom right green group seems to be a Slytherin-type group, or perhaps a professor-type group
* The upper left red group seems to be a student-type group
* It seems curious that one group consists only of Tonks and Bellatrix ...

---

<a name="imp"></a>

# How Important is each Character?

We can also rank each character in the wizarding world by relative importance. How do we define importance? Similarity to Harry Potter himself of course! We can see each character below in terms of their proximity to Harry.

<figure>
<center>
   <a href="/images/radialpotter2.png"><img width="200%" src="/images/radialpotter2.png"></a>
</center>
</figure>

Cool Stuff!:

* We see Harry's closest friends and, well, Snape in the innermost region
* One level further, we see some rather bad guys as well as some core supporting characters
* In the furthest rung, we see some secondary supporting characters and poor old Hedwig the owl

---


Thanks for reading and please leave comments!


