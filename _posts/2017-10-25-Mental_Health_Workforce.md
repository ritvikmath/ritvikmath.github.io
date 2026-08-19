---
layout: post
comments: true
title: Top 5 Most Toxic Workplace Combinations for Mental Health
image: /images/mh_cover.jpg
category: health
methods: [Statistical analysis, Predictive modeling]
summary: Identifying the combinations of workplace conditions most strongly associated with poor mental health.
search_terms: mental health workplace employees jobs employer wellness depression anxiety treatment benefits remote work technology company culture toxic environment survey combinations interactions occupational health
---

<figure>
<center>
   <a href="/images/mh_cover.jpg"><img width="75%" src="/images/mh_cover.jpg"></a>
</center>
</figure>

# Motivation

**Fact 1:** Two-thirds of all Americans report being disengaged at work or actively despise their job

**Fact 2:** Americans spend one third of their day at work

These two facts coupled together don't spell out a positive outlook for the **nation's mental health**. Let us find out which types of workplaces breed, or perhaps attract, the **most workers who report that a mental health issue hinders their productivity at work**. Perhaps by identifying these **toxic factors in workplaces**, we as a nation can **build more mentally hospitable, and thereby more productive, corporate environments**. 

# The Data

The data comes from a 2016 OSMI (Open Sourcing Mental Health) <a href="https://osmihelp.org/research" target="_blank">survey</a> which asked respondents to answer a series of questions related to their workplace including its mental health policies. Respondents were also asked to answer questions about whether they have a mental health issue, and if so, whether it impedes their performance at work. See the notes below about biases in the data.

# So What Are We Going to Measure?

We are going to take each possible pair of factors in our dataset and first compute, independently, what percent of people responding "Yes" to each factor **also report that a mental health issue gets in the way of their work**. 

For example, we look at people who say ***"Yes, my employer discussed mental health with me"*** and compute what proportion of them report a mental health issue getting in the way of work. Then, we look at those who say ***"Yes, I feel comfortable discussing a mental health issue with my supervisor"***, and see what proportion of them report a mental health issue interfering with work. We do the **same with people answering "No"** to each of these questions.


We then look at all the workplaces with a combination of the two factors (***"Yes, my employer discussed mental health with me"*** and ***"Yes, I feel comfortable discussing a mental health issue with my supervisor"***) and compute the proportion of people that report a mental health issue interfering with work. Again, we also consider the **combination of cases where people answer "No"** to these questions.

Last, we compute the average difference between the combined proportion and the two individual proportions and find the highest such differences. In more intuitive terms, **we are finding the workplace factors which, perhaps alone are not toxic, but when combined create a destructive dissonance for employee mental health**.  

Without further ado, let's see the ***top five most toxic workplace combinations***.

{:center: style="text-align: center"}
# #5 - Management vs. Coworkers
{:center}

<figure>
<center>
   <a href="/images/r5.png"><img width="100%" src="/images/r5.png"></a>
</center>
</figure>

This clashing combination ranks in fifth place on our list. It's no secret that **the way your coworkers view you at work is extremely important both professionally and personally**. You want to be liked. In workplaces where the management is respectful of mental health issues, but those who employees interact with more regularly are not, further **stress and anxieties** may arise around keeping one's mental illness a secret.

{:center: style="text-align: center"}
# #4 - An Ambiguous Enterprise
{:center}

<figure>
<center>
   <a href="/images/r4.png"><img width="100%" src="/images/r4.png"></a>
</center>
</figure>

This information-less workplace combination comes in fourth. This workplace first off **fails to provide employees with any mental health resources** and then **gives the impression that there are negative consequences for *physical* health issues**. That is, an employee of this company believes that if she had a broken leg, then management would look down on this or actively punish it. This employee may make the logical conclusion that a workplace inhospitable to physical injury would not be any more hospitable to mental illness.

{:center: style="text-align: center"}
# #3 - Vulnerable and Vicious
{:center}

<figure>
<center>
   <a href="/images/r3.png"><img width="100%" src="/images/r3.png"></a>
</center>
</figure>

This combination ranks third and really speaks for itself. Employees not only *perceive* negative consequences for mental health issues; they have **actively seen coworkers be punished for their mental health issues**. If this were not toxic enough, employees at these companies **must have their mental health illness made public to the company to receive benefits**. It makes sense why employees at such companies would rather keep their mental health issues untreated and avoid punishment, but at the same time, exacerbate their mental illness.

{:center: style="text-align: center"}
# #2 - A Reputation Risk
{:center}

<figure>
<center>
   <a href="/images/r2.png"><img width="100%" src="/images/r2.png"></a>
</center>
</figure>

A possible explanation for our second place combination is that employees note that there is **little sympathy towards physical health issues**, and so, there will likely be even less sympathy for mental health issues. In addition, at a small company, it may be more likely that **word would spread about an employee's mental illness**, causing them to worry about their reputation. Given that even employees with physical health issues are not seen in a positive light, they might figure that employees with mental health issues would be viewed negatively as well. 

{:center: style="text-align: center"}
# #1 - Business Betrayal
{:center}

<figure>
<center>
   <a href="/images/r1.png"><img width="100%" src="/images/r1.png"></a>
</center>
</figure>

The top spot on our list goes to workplaces that **do indeed discuss mental health with employees but which, at the same time, come off as having negative consequences for mental illness**. Employees with mental health issues at such workplaces are likely left **confused as to where their workplace stands on mental health** given the conflicting information and sentiment around the workplace. This confusion can easily lead to distrust in the workplace and deterioration in an employee's mental state. 

# So What?

**What can a corporation do about this?** Really, this brief list gives workplaces a **rudimentary template** with which to improve their operating environments if they fall into one of the sides of any combination in the above list. 

For example, if there is some legal reason as to why employee anonymity cannot be maintained when getting mental health benefits, then a workplace should take **every step possible** to not complete that toxic combination (#3). That is, the workplace should take steps towards **destigmatizing and not punishing employees for using their mental health coverage**. 

In addition, a workplace where management is understanding of mental health issues should go one step further and **ensure that fellow employees also understand that mental health issues, like physical health issues, are very real** and impact people in equally serious ways. 

Indeed, often workplaces cannot help falling into some of the categories outlined in this list (a small company cannot instantaneously grow), but they can take steps towards **ensuring that they do not fall into both categories of any toxic pair**.

# Notes

* It is important to note that since our data is in the form of a self-reported survey, we will inherently have some bias. For example, given that this survey is about mental health issues in workplace, we can expect that people with strong feelings about this topic (such as those with mental health issues) are probably more likely to respond. 

* In addition, it is very possible that multiple people from the same company respond to the survey together, causing that company to be overrepresented. Still, we should be somewhat safe from these biases since we are measuring relative magnitudes of differences in certain percentages, ignoring the biased percentages themselves.

* In discussing the possible causes for the five toxic combinations, it is important to note that we cannot concretely prove causality in these cases. That is, these possible causes should be seen as just that: possibilities, rather than true causes.

* For those interested in the average percent increases in each of the five cases, they are: 

Management vs. Coworkers: +12.7%

An Ambiguous Enterprise: +13.4%

Vulnerable and Vicious: +14.5%

A Reputation Risk: +15.5%

Business Betrayal: +16.8%

Thanks for reading and please leave comments!
