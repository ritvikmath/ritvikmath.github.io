---
layout: post
comments: true
title: How to Get a Second Date
image: /images/cover_img_speed_sec.png
category: relationships
summary: Turning real speed-dating data into a practical model of attraction and second-date decisions.
search_terms: romance attraction dating relationships love compatibility beauty sincerity intelligence ambition fun machine learning prediction random forest classification psychology gender preferences match second date decisions
---

<figure>
<center>
   <a href="/images/cover_img_speed_sec.png"><img width="70%" src="/images/cover_img_speed_sec.png"></a>
</center>
</figure>

<center>
<font size="5"><b>Mastering the Mechanics of the Dating Market</b></font>
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

<html>
<head>

<script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
    <script type="text/javascript">
      google.charts.load('43', {'packages':['sankey']});
      google.charts.setOnLoadCallback(drawChart);

      function drawChart() {
        var data = new google.visualization.DataTable();
        data.addColumn('string', 'From');
        data.addColumn('string', 'To');
        data.addColumn('number', 'Number of People');
        data.addRows([
			['Prefer Shared Interests', 'Chose Shared Interests', 1],
			['Prefer Fun', 'Chose Sincerity', 4],
			['Prefer Fun', 'Chose Attractiveness', 8],
			['Prefer Attractiveness', 'Chose Fun', 22],
			['Prefer Shared Interests', 'Chose Ambition', 1],
			['Prefer Fun', 'Chose Fun', 2],
			['Prefer Shared Interests', 'Chose Sincerity', 3],
			['Prefer Attractiveness', 'Chose Attractiveness', 76],
			['Prefer Sincerity', 'Chose Shared Interests', 1],
			['Prefer Intelligence', 'Chose Sincerity', 30],
			['Prefer Attractiveness', 'Chose Shared Interests', 3],
			['Prefer Ambition', 'Chose Fun', 1],
			['Prefer Sincerity', 'Chose Attractiveness', 41],
			['Prefer Intelligence', 'Chose Shared Interests', 4],
			['Prefer Ambition', 'Chose Intelligence', 3],
			['Prefer Sincerity', 'Chose Ambition', 9],
			['Prefer Shared Interests', 'Chose Attractiveness', 4],
			['Prefer Intelligence', 'Chose Fun', 7],
			['Prefer Sincerity', 'Chose Fun', 11],
			['Prefer Intelligence', 'Chose Attractiveness', 37],
			['Prefer Attractiveness', 'Chose Sincerity', 69],
			['Prefer Sincerity', 'Chose Sincerity', 32],
			['Prefer Attractiveness', 'Chose Intelligence', 63],
			['Prefer Sincerity', 'Chose Intelligence', 25],
			['Prefer Intelligence', 'Chose Ambition', 4],
			['Prefer Attractiveness', 'Chose Ambition', 12],
			['Prefer Fun', 'Chose Intelligence', 10],
			['Prefer Ambition', 'Chose Sincerity', 1],
			['Prefer Shared Interests', 'Chose Intelligence', 1],
			['Prefer Fun', 'Chose Ambition', 2],
			['Prefer Intelligence', 'Chose Intelligence', 35]
        ]);

        // Sets chart options.
        var options = {
          width: 725,
		  sankey:{
			  node: {
				label: {
				  fontSize: 14,
				  bold: true
				}},
	
			link: {colorMode: 'source',
				color: {fillOpacity: 1,  strokeWidth: 1}
			}
			}
		  
        };
        
        

        // Instantiates and draws our chart, passing in some options.
        var chart = new google.visualization.Sankey(document.getElementById('sankey_basic'));
        chart.draw(data, options);
      }
      
      </script>
</head>
</html>

---


Quick Links: 

* [Background and Data](#bdat)  
* [How to Get a Second Date](#secdate)
* [Can You Accurately Predict Your Own Value in the Dating Market?](#value)
* [Do You have a 'Type' When it Comes to Dating?](#type)
* [All Roads Lead to Attractiveness](#transfs)
* [Does Dating More People Change the Way You Think?](#order)
* [Who is Most Likely to Want a Second Date with You?](#categs)
* [Are Some People Actually Out of Your League?](#league)
* [Conclusions](#conc)

---
---
<a name="bdat"></a>

# Background and Data

Dating has long been regarded as a simultaneously rule-driven and mysterious game. You need to **dress well, seem interested in everything your date says**, but all the while, **"be yourself"**. You need to come off as **fun and exciting** but **not share the most important and intimate parts of yourself so soon**. Indeed, a first date can often be a mixture of **exciting, confusing, and scary** and can leave you wondering if you did "enough" to get a second date with the other person. This problem has long been studied from a psychological and biological standpoint, but now we will tackle it in the **data science** arena.

<figure>
<center>
   <a href="/images/speed_date.jpg"><img width="50%" src="/images/speed_date.jpg"></a>
</center>
</figure>

For this analysis we will use **<a href="https://www.kaggle.com/annavictoria/speed-dating-experiment" target="_blank">speed dating data</a>** compiled by professors at the **Columbia Business School in 2002-2004**. They invited waves of attendees to come in and participate in the study. Each wave consisted of a variable number of attendees, but there were the **same number of males and females per wave**. The study would then progress as follows. Each attendee would fill out a preliminary questionnaire with several questions, including their **preferences in potential dates along six traits**: ***Attraction, Intelligence, Sincerity, Fun, Ambition, and Shared Interests***. In addition, **each attendee would rank themselves** on five attributes: ***Attraction, Intelligence, Sincerity, Fun, and Ambition***. Each male-female pair would then go on a **quick 4 minute "speed date"** and would have the chance to **rank their partners on the previously mentioned six attributes** as well as **indicate whether or not they would like to schedule a second date with their partner**.

Viewing this study as a plethora of opportunities for two people to feel **"love at first sight"**, we can start asking many of the age old questions when it comes to dating and specifically first dates. 

---
<a name="secdate"></a>

# How to Get a Second Date

If we **analyze all the dates in our study where someone requested a second date**, and **compare them with those where no second date was requested**, we should be able to **tease out the factors which make or break whether your date will ask to go out with you again**. We do just that by using a machine learning model called the **<a href="https://en.wikipedia.org/wiki/Random_forest" target="_blank">Random Forest</a>**. This model basically works by trying to answer the question: **"Will someone request to go on a second date?"** and arrives at its final answer by **asking a series of yes or no questions**. We will judge our Random Forest model on two metrics, **accuracy and precision**. 

**Accuracy is simply the number of dates where the model correctly predicts whether or not there will be a second date divided by the total number of dates**. **Precision**, a related but different measure, **is the proportion of dates where the model gives a correct prediction out of only the dates where the model predicts that there will be a second date**. That is, precision measures how "correct" the Random Forest model is when it predicts that you will get a second date.

Let's see how the accuracy and precision of our Random Forest model compare to just plain old random guessing.

<figure>
<center>
   <a href="/images/gain.png"><img width="100%" src="/images/gain.png"></a>
</center>
</figure>

We see that our Random Forest model performs much better than random guessing and has fairly high accuracy and precision levels. With this confidence in our model, we are now ready to list the model's top five factors in predicting whether you will get a second date.

## Top 5 Factors in Getting a Second Date

<figure>
<center>
   <a href="/images/important_features.png"><img width="100%" src="/images/important_features.png"></a>
</center>
</figure>

Note that the length of the bars is proportional to how strong of a predictor that factor is.

**Key Takeaways:**

* The **top factor in determining whether you get a second date is simply how much your date liked you overall**. This naturally matches up with our intuition
* The next three are how attractive, fun, and involved in their interests they think you are, respectively. Here we already get **indications that attractiveness, above all other traits, determines how much someone wants to see you again**, at least upon first impression
* Interestingly, the fifth most important factor is how likely your date thinks it is that you will say 'yes' to a second date. It seems like **people judge whether they want a second date not only by how they perceive you, but also by how they think you perceive them**

---
<a name="value"></a>

# Can You Accurately Predict Your Own Value in the Dating Market?

In addition to a bunch of opportunities for "love at first sight", **we can also view our data as a two-sided economic market**, where **value is determined by other participants in the market**. If this seems a bit abstract, let's break it down. You, as a person, have a certain social value on five traits we have data for: **Attractiveness, Intelligence, Ambition, Fun, and Sincerity**. That **value is determined by a combination of the scores that all your dates give you** for these traits. 

For example, if you go on five dates, and they score your attractiveness as: 7/10, 8/10, 9/10, 8/10, 7/10, then we take the **average** of these and say that your **"dating market value"** for attractiveness is 7.8/10. We do the same for the other traits.

The key question is **whether the value you assign to yourself, before the study begins, is close to your actual value** or very far from it. If we find that, on average, the self-assigned values and the dating market values are close, people generally have a good idea of their worth in the dating market. On the other hand, if the self-assigned values are far from the dating market values, we need to ask whether the self-assigned values are higher or lower and why this might be. **We report the results below.**

<figure>
<center>
   <a href="/images/self_others.png"><img width="70%" src="/images/self_others.png"></a>
</center>
</figure>

**Interesting!** So we see that on **all five traits, people perceive their own value to be at least 13% higher than the dating market perceives their value to be**. We see that the **greatest discrepancy happens with "fun"**. That is, people perceive themselves to be much more fun than the dating market does. This might be because **"fun" is so subjective** and each person will believe the things he or she is interested in to be fun while an outsider may find these things mundane or dull. Other **high discrepancy traits include attractiveness and sincerity**. 

Interestingly, the **lowest discrepancies occur with intelligence and ambition**, both of which are **more measurable than the other three traits**. That is, **intelligence can be measured by way of IQ tests, or school grades, etc.**. Ambition can be pseudo-measured by how well you did in school, how "good" of a job you have, etc. On the other hand, **beauty is in the eye of the beholder**, and it can be argued that fun and sincerity are as well. Of course, these are just the ***thoughts of this author***. Feel free to come up with your own theories for why these discrepancies might be the way they are and **post your thoughts in the comments below!**

---
<a name="type"></a>

# Do You have a 'Type' When it Comes to Dating?

Tall, dark, and handsome. Green-eyed brunettes. Fitness freaks. When it comes to dating, we often hear about people having "types". That is, we are often told (maybe by our annoying friends) that we **over and over go for the same type of person**, whether we accept it or not. Can we use our data to help answer the question of **whether people are attracted to certain "types" of other people?** 

To make this more concrete, we will consider our "types" as our six attributes: **Attractive, Intelligent, Ambitious, Fun, Sincere, and Sharing of Interests**. We proceed by **taking a look at the correlation between these attributes**. Why? Well, imagine that when we look at the data for how intelligent people scored their dates, we find that it is highly correlated with how sincere they scored their dates. That is, **we find that people, whether consciously or subconsciously, think of intelligent people as also sincere**. This gives us evidence that perhaps intelligence and sincerity are not separate, but are **really part of one combined "type"**.

To be clear, we will be using an **arrow from one trait to another if the latter trait is the most correlated with the former trait**. Here is a visual example with our intelligence-sincerity example.

<figure>
<center>
   <a href="/images/ex_graph.png"><img width="80%" src="/images/ex_graph.png"></a>
</center>
</figure>

When we apply this method to all six traits, we get the following surprising result.

<figure>
<center>
   <a href="/images/groups.png"><img width="100%" src="/images/groups.png"></a>
</center>
</figure>

We see **two disjoint groups with three traits each**. Let's take a look at each one in turn. We see that the **group on the left consists of fun, shared interests, and attractiveness**. Intuitively, this means that **people group these traits together very tightly when scoring their dates**. **On the right**, we see the other three traits: **intelligence, sincerity, and ambition**. 

There is a very **natural story behind this divide**. It seems natural that **intelligent people might be ambitious** since they would be able to apply their intellect towards their goals. We can also make a case for **intelligent people seeming to be very knowledgeable about facts, therefore coming off as sincere**. 

On the other side, we **often associate people we find physically attractive with being fun-loving or exciting**. We are also very likely to **consider people fun because they like doing the same things as us**, therefore giving them a high score in shared interests.

So it seems like, coarsely, there are two "types" of people: the **attractive, fun-loving ones**, and the **intelligent, ambitious ones**. Of course, **this is only given the six traits we have data for**, and **only uses the top correlated trait with each other trait**, but it definitely seems natural and informative that the **data reflects the social constructs we are used to**.

---
<a name="transfs"></a>

# All Roads Lead to Attractiveness

Do you have that friend who says they're looking for something in a potential romantic partner and then **always ends up picking people who are the exact opposite**? Maybe you are that friend ... Either way, it's no surprise that **what we say we want in a romantic partner and what our actions say are often two completely different things**. 

Luckily, our data gives us the ability to **see what people say they prefer** in a partner (in terms of our six attributes) and then **compare that to what they actually want**, based on the prevalent traits of the people they request to go on a second date with. 

As an example, **suppose that you rank intelligence as your top desired trait** before going on any of the speed dates. Suppose after going on 10 speed dates, you request to have a second date with 5 of them. Suppose furthermore that **among those 5 chosen people, the trait with the highest average score was ambition**. We will then say that **you prefer intelligence but end up choosing to go on second dates with ambitious people**.

We do this for all the attendees and produce the Sankey diagram below. **Hover over the links** to find out **how many people who initially preferred a certain trait ended up requesting second dates with people of a predominantly second trait**.

<br>
<br>
<html>

<div id="sankey_basic" style="width:400px; height: 500px;"></div>

</html>

<br>
<br>

There are **two key takeaways** from this diagram.

First off, we see that **a large majority of people initially prefer attractiveness**. Still, **after all the dates are said and done, people seem to diversify** in terms of the people they request a second date with. That is, attractiveness takes up a smaller share of the chosen traits on the right than the preferred traits on the left. 

Secondly, we see that in some sense **"all roads lead to attractiveness"**. If we look at all the preferred traits on the left and trace where most of the attendees end up on the right hand side, the answer is attractiveness for **four of the six traits**. Furthermore, the two traits where this is not true, **fun and ambition, have a very small number of people who initially claim to prefer them**. We thus have evidence which says that **no matter what people claim to want in a romantic partner, they typically end up going for attractive people based on first impressions**. This makes some sense. After all, on a first date, it is much easier to judge someone’s attractiveness than it is to judge their sincerity or intelligence.

---
<a name="order"></a>

# Does Dating More People Change the Way You Think?

Another angle we can study is that of date order. That is, suppose you go on ten speed dates through the night. **Are you any more likely to request a second date with the first person than the tenth person?** Perhaps the longer your night goes on, the less likely you are to request second dates because you've already met acceptable people. Or is it the opposite? Is it that you hold out for better people and so tend to reject your first few dates? The answer will surely vary by person, but **we are interested here in global behavior**.

We perform this analysis by simply **sorting the dates into buckets** based on their order (first, second, etc.) through the night, and **finding the percent of dates where a second date was requested in each bucket**. We display the results below.

<figure>
<center>
   <a href="/images/order_of_dates.png"><img width="100%" src="/images/order_of_dates.png"></a>
</center>
</figure>

**Key Takeaways:**

Although the trend jumps around quite a bit, **we see overall that it is decreasing**. This tells us that **as the night goes on**, as you have more and more dates, **you become less and less likely to request second dates** with potential partners. This is perhaps a confirmation of our idea that you tend to meet someone or some people acceptable fairly soon in the dating process and become less interested in the later people you meet. This may hold true even if those later people are acceptable and you **would have requested a second date with them if only you met them earlier** in the dating process. It seems **timing is key for dating!**

Still, we should discuss the **volatility in our trend** since it holds a potential story as well. For instance, note just the **jump down from the first person you meet and the second person you meet**. For the **first person**, you have a **50-50 chance of requesting a second date**. On the other hand, for the **second person** you meet, you are **only 40% likely** to request a second date. 

What can explain this 10% drop? Well, ***perhaps*** it is a psychological phenomenon (this author, not being a psychologist, needs to strongly emphasize the word "perhaps" here). Perhaps you are excited to meet the first person and want to **give them a chance** even if they don't fully meet your standards. Indeed the **"second date rate" is highest for date number 1**. But then, perhaps upon meeting the second person, **you feel like you shouldn't say "yes" to two people in a row** so you have a higher tendency to say "no" to the second person. Indeed, this would not only explain the jump between the first and second points, but also the **up-down pattern in the rest of the graph** as well. Still, just a theory. **Post your thoughts in the comments below!**

---
<a name="categs"></a>

# Who is Most Likely to Want a Second Date with You?

We established before that we can assign a **"dating market value"** to each person based on five attributes: **attractiveness, intelligence, fun, ambition, and sincerity**. Note we leave out shared interests because its value is dependent on each pair of people rather than each person by themselves. 

We can then ask questions about how each of these types of people behave when it comes to **requesting second dates** and **getting offered second dates by others**. That is, do attractive people (those with high dating market values of attractiveness) get many second date offers whilst requesting relatively few? Do sincere people request second dates at a very high rate? **Are there really any significant differences at all** between these groups of people or are we just splitting them up arbitrarily?

We answer this question by simply splitting up all the people in our data into one of the five aforementioned categories **depending on the attribute for which they have the highest dating market value**. For each of the five groups we then calculate two numbers. We first find the **probability of asking for a second date** and second find the **probability of being asked for a second date**.

We display the results below.

<figure>
<center>
   <a href="/images/ask_asked2.png"><img width="100%" src="/images/ask_asked2.png"></a>
</center>
</figure>

***Wow!*** Look at the bars for "attractive" people. We see that **attractive people only ask around 32% of their dates for a second date** while those who go on dates with attractive people are about 66%, ***twice as likely***, to ask them for second dates. This indeed is in line with the ideas of exclusivity around people we think of as attractive.

The discrepancies between the bars for other types of people are not nearly as drastic. In fact, we see that **sincere, intelligence, and ambitious people are more likely to ask for a second date than be asked for a second date**, if only by small margins. We also see that **fun people are the most likely to ask for a second date, with a nearly 50% rate**.

The key takeaway here is still clearly about attractiveness and how its worth cannot be trivialized in the dating market. It is clear, from this chart and previous ones, that **people who are considered attractive immediately get asked for second dates**, but seldom feel obligated to do the same for others.

---
<a name="league"></a>

# Are Some People Actually Out of Your League?

We will conclude our analysis by looking at the idea of **"leagues"**. We've all heard the phrase "She's way out of your league", meaning that **she and you inherently have a different worth on the dating market** (to phrase it in a really awkward way).  

We want to find out if there is evidence that "leagues" exist. We can test for this by analyzing two groups within our data: **matches and mismatches**. A **match** will be defined as a date where **both people request a second date with one another** while a **mismatch** is a date where **one person requests a second date but the other does not**. If leagues exist, we expect that the dating market values of the matches are much closer together than the dating market values of the mismatches. We analyze this for two traits: **attractiveness and intelligence**. Let's to right to the results!

<figure>
<center>
   <a href="/images/attr_mm_b.png"><img width="100%" src="/images/attr_mm_b.png"></a>
</center>
</figure>

Indeed, we see that with attractiveness, the absolute differences in dating market value are more heavily piled around zero for the matches than the mismatches. Story wise, this says that **people who match with each other tend to be of the same attractiveness** while **those who mismatch tend to be of different attractiveness** levels in the dating market.

Let's see if we have the same story with intelligence.

<figure>
<center>
   <a href="/images/intel_mm_b.png"><img width="100%" src="/images/intel_mm_b.png"></a>
</center>
</figure>

We see a **very similar trend for intelligence**. That is, we again see that the **absolute differences in dating market values are piled more heavily around zero for matches than mismatches**. It is **less drastic here though**, than with attractiveness. This perhaps says that **attractiveness more naturally separates into these "leagues" than does intelligence**, which is perhaps a result of it being more difficult to ascertain someone's intelligence in 4 minutes than their attractiveness.

Indeed, it seems from our analysis that **these "leagues" exist**, certainly for attractiveness, and arguably for intelligence. 

---
<a name="conc"></a>

# Conclusions

The title of this article is **How to Get a Second Date**. If that is truly your sole goal, then the analyses derived through this study should help you along. Still, this article does little to answer a much more difficult question: **Should you want a second date?** 

So often we focus on wanting to impress the person in front of us during a date or just a casual chat, that we **forget to be ourselves**. We become a **watered down, beauty-focused, insincere version of ourselves** hoping that the person we are with will eventually accept the "real" us. 

Perhaps it is better to go into a first date with a **hybrid mentality**, keeping in mind both the findings above regarding the **importance of attractiveness** on the first date, making an **attempt to share your date's interests**, etc., but also to ***be yourself, presenting proudly the person that you are***. If, after all that, you get turned down for a second date, then it is **100% for the best**, since ***you absolutely deserve to be with someone who deserves to be with you***. 

<figure>
<center>
   <a href="/images/hold_hands.jpg"><img width="70%" src="/images/hold_hands.jpg"></a>
</center>
</figure>

**Thanks for reading and please leave comments below!**

---
