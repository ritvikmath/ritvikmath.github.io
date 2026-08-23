---
layout: post
comments: false
title: The Function That Keeps Up With Itself
image: /images/header_self_derivative.svg
category: mathematics
methods: [Calculus, Differential equations, Data visualization]
summary: Why the derivative of eˣ is itself, what other functions can pull off the same trick, and what this reveals about feedback and growth.
search_terms: exponential natural exponential Euler number e derivative self derivative fixed point eigenfunction differentiation operator ordinary differential equation ODE proportional growth feedback compounding rate of change power series Taylor series factorial logarithmic derivative sine cosine calculus
---

<figure class="self-derivative-hero">
  <img src="/images/header_self_derivative.svg" alt="The graphs of the exponential function and its derivative perfectly overlapping">
</figure>

<script>
  window.MathJax = { tex: { inlineMath: [['$','$']], displayMath: [['\\[','\\]']] }, svg: { fontCache: 'global' } };
</script>
<script defer src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>

There is one fact from calculus that I have always found especially interesting:

$$
\frac{d}{dx}e^x=e^x.
$$

A derivative gives the instantaneous rate at which a function is changing. For $e^x$, that rate is equal to the value of the function itself. When the value is $2$, the slope is $2$. When the value is $100$, the slope is $100$.

This raises a natural question:

{:center: style="text-align: center"}
**Which functions are equal to their own derivatives?**
{:center}

We will start with the equation

$$
f'(x)=f(x)
$$

and see what follows. We will find every solution, look at the power series, and then connect the result to growth and feedback.

## Let's Start With a Larger Family {#feeling}

First, consider the family

$$
f_\lambda(x)=e^{\lambda x}.
$$

Differentiating gives

$$
f_\lambda'(x)=\lambda e^{\lambda x}=\lambda f_\lambda(x).
$$

The ratio between the slope and the value is therefore always

$$
\frac{f_\lambda'(x)}{f_\lambda(x)}=\lambda.
$$

This gives us three useful cases:

* If $0&lt;\lambda&lt;1$, the derivative is a smaller multiple of the function.
* If $\lambda&gt;1$, the derivative is a larger multiple of the function.
* If $\lambda=1$, the derivative and the function are equal.

<section class="derivative-lab" aria-labelledby="derivative-lab-title">
  <div class="derivative-lab-copy">
    <p class="lab-kicker">A small calculus lab</p>
    <h3 id="derivative-lab-title">Move the growth rate</h3>
    <p>The navy curve is $f_\lambda(x)=e^{\lambda x}$ and the coral curve is its derivative. When $\lambda=1$, the two curves match.</p>
    <label for="lambda-control">Growth rate <strong id="lambda-value">1.00</strong></label>
    <input id="lambda-control" type="range" min="0.25" max="1.75" value="1" step="0.05">
    <output id="lambda-reading">The derivative is exactly the function.</output>
  </div>
  <div class="derivative-chart-wrap"><canvas id="derivative-chart" aria-label="Interactive comparison of an exponential function and its derivative"></canvas></div>
</section>

Note that “smaller” and “larger” above refer to the multiplier for a positive function. The precise statement is that the derivative is a constant multiple of the function, with $lambda$ giving that multiple.

## Finding Every Function {#all-solutions}

Now let's answer our main question. Suppose a differentiable real-valued function satisfies

$$
f'(x)=f(x)
$$

throughout an interval. Multiply it by $e^{-x}$ and call the result $g(x)$:

$$
g(x)=e^{-x}f(x).
$$

The product rule gives

$$
\begin{aligned}
g'(x)
&= -e^{-x}f(x)+e^{-x}f'(x)\\
&=e^{-x}\bigl(f'(x)-f(x)\bigr)\\
&=0.
\end{aligned}
$$

A function whose derivative is zero on an interval must be constant there. So $g(x)=C$, which means

$$
e^{-x}f(x)=C
$$

and therefore

$$
\boxed{f(x)=Ce^x.}
$$

We now have the full answer. Every real function that is its own derivative is a constant multiple of $e^x$. Some examples are $e^x$, $7e^x$, $-\pi e^x$, and the zero function when $C=0$.

So $e^x$ is unique once we pin down one value. If we also ask for $f(0)=1$, then

$$
1=f(0)=Ce^0=C,
$$

leaving $f(x)=e^x$ and nothing else.

Thus, $Ce^x$ gives all possible solutions. The condition $f(0)=1$ picks out the familiar function $e^x$.

## Another Way: Power Series {#coefficients}

Let's derive the answer a second way using power series.

Suppose $f$ can be written as a power series:

$$
f(x)=a_0+a_1x+a_2x^2+a_3x^3+\cdots.
$$

Its derivative is

$$
f'(x)=a_1+2a_2x+3a_3x^2+4a_4x^3+\cdots.
$$

For $f'=f$, the coefficient of every power of $x$ must match. Therefore

$$
a_1=a_0,\qquad 2a_2=a_1,\qquad 3a_3=a_2,\quad\ldots
$$

or, in one line,

$$
(n+1)a_{n+1}=a_n.
$$

Starting from $a_0=C$, this recurrence forces

$$
a_n=\frac{C}{n!}.
$$

So the only possible series is

$$
f(x)=C\left(1+x+\frac{x^2}{2!}+\frac{x^3}{3!}+\cdots\right)=Ce^x.
$$

Why do the factorials appear? Each derivative pulls down a factor of $1,2,3,\ldots$. The factorial denominators cancel those factors in exactly the right order. Thus, the Taylor series for $e^x$ is exactly the series required by $f'=f$.

## The Linear Algebra Connection {#family}

We can now return to the larger family where the derivative is a constant multiple of the function:

$$
f'(x)=\lambda f(x).
$$

The same argument gives

$$
\boxed{f(x)=Ce^{\lambda x}.}
$$

This is an example of an **eigenfunction**. In linear algebra, an eigenvector keeps its direction after a transformation and is only scaled. Here, differentiation is the transformation and the functions $e^{\lambda x}$ keep their shape. The number $\lambda$ is the eigenvalue:

$$
D\bigl(e^{\lambda x}\bigr)=\lambda e^{\lambda x}.
$$

When $\lambda=1$, the scaling factor is also $1$, so differentiation returns the original function.

<div class="math-notebook-table" role="table" aria-label="How the eigenvalue changes an exponential function">
  <div role="row"><strong role="columnheader">Eigenvalue</strong><strong role="columnheader">What differentiation does</strong><strong role="columnheader">Behavior</strong></div>
  <div role="row"><span>$\lambda&lt;0$</span><span>Flips direction and scales</span><span>Exponential decay</span></div>
  <div role="row"><span>$\lambda=0$</span><span>Returns zero</span><span>A constant function</span></div>
  <div role="row"><span>$0&lt;\lambda&lt;1$</span><span>Shrinks the function</span><span>Slower growth</span></div>
  <div role="row"><span>$\lambda=1$</span><span>Returns the same function</span><span>Perfect self-derivative</span></div>
  <div role="row"><span>$\lambda&gt;1$</span><span>Stretches the function</span><span>Faster growth</span></div>
</div>

## Why Feedback Produces an Exponential {#feedback}

The equation $f'=\lambda f$ is also a feedback rule: the amount present determines the rate at which the amount changes.

Over a tiny step $\Delta x$, the derivative gives the approximation

$$
f(x+\Delta x)\approx f(x)+f'(x)\Delta x.
$$

Substituting $f'=\lambda f$,

$$
f(x+\Delta x)\approx \bigl(1+\lambda\Delta x\bigr)f(x).
$$

Each small step multiplies the current amount by approximately the same growth factor. If we repeat this process while making the steps smaller, we get continuous compounding:

$$
f(x)=f(0)e^{\lambda x}.
$$

This explains why exponential functions appear in population growth, radioactive decay, continuously compounded interest, cooling models, and simple epidemic models. In each example, the current amount helps determine the rate of future change.

For $f'=f$, the feedback strength is exactly $1$. One unit of current value creates one unit of instantaneous change per unit of $x$. This is the balance we were looking for: the state and its rate of change have the same numerical value.

<aside class="units-note">
  <strong>A small but important units check</strong>
  <p>If $x$ measures time, then $f'$ has units of “$f$ per unit time,” while $f$ does not. The physical equation is $f'=\lambda f$, where $\lambda$ has units of inverse time. Writing $f'=f$ means we chose a time scale for which $\lambda=1$.</p>
</aside>

## What Happens After Two Derivatives? {#cycles}

The equation $f'=f$ is very restrictive. If we look at repeated derivatives, we find some additional patterns.

Every $Ce^x$ remains unchanged forever:

$$
f=f'=f''=f'''=\cdots.
$$

If we ask only for $f''=f$, both growth and decay fit:

$$
f(x)=Ae^x+Be^{-x}.
$$

The first derivative can change the mixture, but the second brings it back. And if we change the sign to $f''=-f$, we get oscillation:

$$
f(x)=A\cos x+B\sin x.
$$

Sine and cosine travel around a four-step derivative cycle:

$$
\sin x\;\longrightarrow\;\cos x\;\longrightarrow\;-\sin x\;\longrightarrow\;-\cos x\;\longrightarrow\;\sin x.
$$

Sine and cosine are not individually their own derivatives. Instead, differentiation cycles between them. If we allow complex-valued functions, we get another eigenfunction:

$$
\frac{d}{dx}e^{ix}=i e^{ix}.
$$

## Final Takeaway

We started by asking which functions satisfy $f'=f$. We found that every solution has the form $Ce^x$. If we also require $f(0)=1$, then $e^x$ is the unique answer.

This gives a precise meaning to the idea that $e^x$ behaves like an identity under differentiation. Differentiation is not the identity operator for all functions. However, for every function of the form $Ce^x$, it acts exactly like the identity:

$$
D f=f.
$$

A function goes into differentiation and the same function comes back out. Pretty cool!

## Sources and Further Reading

The derivative of the natural exponential function and the constant ratio between an exponential function's rate of change and value are covered in <a href="https://openstax.org/books/calculus-volume-1/pages/3-9-derivatives-of-exponential-and-logarithmic-functions" target="_blank" rel="noopener">OpenStax Calculus, Section 3.9 ↗</a>. The use of exponential trial solutions for differential equations is discussed in <a href="https://openstax.org/books/calculus-volume-3/pages/7-1-second-order-linear-equations" target="_blank" rel="noopener">OpenStax Calculus, Section 7.1 ↗</a>.

<script src="/assets/self-derivative.js" defer></script>
