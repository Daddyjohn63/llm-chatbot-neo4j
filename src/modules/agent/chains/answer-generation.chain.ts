import { BaseLanguageModel } from '@langchain/core/language_models/base';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { OpenAI } from '@langchain/openai';
//import OpenAI from 'openai';
//import { BaseLanguageModel } from "langchain/base_language";

// tag::interface[]
export interface GenerateAnswerInput {
  question: string;
  context: string;
}
// end::interface[]

// tag::function[]
export default function initGenerateAnswerChain(
  llm: BaseLanguageModel
): RunnableSequence<GenerateAnswerInput, string> {
  const answerQuestionPrompt = PromptTemplate.fromTemplate(`
    Use only the following context to answer the following question.

    Question:
    {question}

    Context:
    {context}

    Answer as if you have been asked the original question.
    Do not use your pre-trained knowledge.

    If you don't know the answer, just say that you don't know, don't try to make up an answer.
    Include links and sources where possible.
    `);
  // TODO: Create a Prompt Template
  // const answerQuestionPrompt = PromptTemplate.fromTemplate(`
  // TODO: Return a RunnableSequence
  return RunnableSequence.from<GenerateAnswerInput, string>([
    answerQuestionPrompt,
    llm,
    new StringOutputParser()
  ]);
}
// end::function[]

const llm = new OpenAI(); // Or the LLM of your choice
const answerChain = initGenerateAnswerChain(llm);

async function run() {
  const output = await answerChain.invoke({
    question: 'Who is the CEO of Neo4j?',
    context: 'Neo4j CEO: Emil Eifrem'
  });
  console.log(output);
}
run();

/**
 * How to use this chain in your application:

// tag::usage[]
const llm = new OpenAI() // Or the LLM of your choice
const answerChain = initGenerateAnswerChain(llm)

const output = await answerChain.invoke({
  input: 'Who is the CEO of Neo4j?',
  context: 'Neo4j CEO: Emil Eifrem',
}) // Emil Eifrem is the CEO of Neo4j
// end::usage[]
 */
