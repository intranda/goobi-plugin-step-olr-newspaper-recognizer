package de.intranda.goobi.plugins.newspaperRecognizer.model;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.apache.commons.lang3.StringUtils;

import de.intranda.goobi.plugins.newspaperRecognizer.data.BlockStart;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;

/** A block over a contiguous range of pages, with its child blocks. */
@Getter
public class BlockNode {
    private final BlockStart start;
    private final int level;
    private final int firstPage;
    @Setter(AccessLevel.PACKAGE)
    private int lastPage;
    private final BlockNode parent;
    private final List<BlockNode> children = new ArrayList<>();

    BlockNode(BlockStart start, int level, int firstPage, BlockNode parent) {
        this.start = start;
        this.level = level;
        this.firstPage = firstPage;
        this.lastPage = firstPage;
        this.parent = parent;
    }

    public String id() {
        return start.getId();
    }

    public String type() {
        return start.getType();
    }

    public Optional<LocalDate> date() {
        return StringUtils.isBlank(start.getDate()) ? Optional.empty() : Optional.of(LocalDate.parse(start.getDate()));
    }

    public boolean contains(int first, int last) {
        return firstPage <= first && last <= lastPage;
    }
}
