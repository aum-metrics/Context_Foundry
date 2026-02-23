# app/services/storytelling.py

class DataStoryteller:
    """
    Simple structured storytelling engine for AUM Studio.
    You can expand each method with LLM logic later.
    """

    def __init__(self):
        # Mapping from story type → method
        self.story_generators = {
            'overview': self.generate_overview_story,
            'insights': self.generate_insights_story,
            'summary': self.generate_summary_story,
        }

    # -----------------------------
    # PUBLIC MAIN METHOD
    # -----------------------------
    def generate_complete_story(self, domain: str, insights: list, data_summary: dict):
        parts = []

        parts.append(self.generate_overview_story(domain, data_summary))
        parts.append(self.generate_insights_story(insights))
        parts.append(self.generate_summary_story(domain, insights, data_summary))

        return "\n\n".join(parts)

    # -----------------------------
    # STORY SECTIONS
    # -----------------------------

    def generate_overview_story(self, domain: str, data_summary: dict):
        return (
            f"### Overview\n"
            f"The dataset for **{domain}** was analyzed. "
            f"It contains {data_summary.get('rows', 'N/A')} rows and "
            f"{data_summary.get('columns', 'N/A')} columns. "
            f"The data quality appears {data_summary.get('quality', 'unknown')}."
        )

    def generate_insights_story(self, insights: list):
        if not insights:
            return "### Insights\nNo major insights were detected."

        formatted = "\n".join([f"- {i}" for i in insights])
        return f"### Key Insights\n{formatted}"

    def generate_summary_story(self, domain: str, insights: list, data_summary: dict):
        return (
            f"### Summary\n"
            f"The analysis reveals key patterns in the **{domain}** domain. "
            f"A total of **{len(insights)}** insights were extracted. "
            f"These findings can guide better decisions and optimization strategies."
        )

    # -----------------------------
    # OPTIONAL: SELECT A SPECIFIC STORY TYPE
    # -----------------------------
    def generate_story(self, story_type: str, *args, **kwargs):
        handler = self.story_generators.get(story_type)
        if not handler:
            raise ValueError(f"Unknown story type: {story_type}")
        return handler(*args, **kwargs)
